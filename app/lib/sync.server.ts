import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

import { BATCH_SIZE } from "~/lib/constants.server.ts";
import { sql } from "~/lib/db.server.ts";
import { insertBatchTelegramMessagesAndChannel, insertBatchTweetsAndUsers } from "~/lib/sql.server.ts";
import {
  AdvancedSearchResponse,
  ApiSyncResponse,
  DbTelegramChannel,
  DbTelegramMessage,
  SyncSource,
} from "~/lib/types.ts";

/* ---------------------------------- SYNC ---------------------------------- */
export const sync = async (
  request: Request,
  sources: Array<SyncSource>,
  syncType: "initial-sync" | "periodic-sync",
) => {
  // Verify the request is from a cron job or has proper authorization
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized access attempt to update-tweets endpoint");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const syncResults = await Promise.all(
      sources.map(async (sync) => {
        if (sync.platform === "twitter")
          return { platform: "twitter", count: await syncTweets([sync.username], syncType) };
        if (sync.platform === "telegram") return { platform: "telegram", count: await syncTelegram([sync.channel]) };
        return { platform: undefined, count: 0 };
      }),
    );

    const platformBreakdown = syncResults.reduce(
      (acc, result) => {
        acc[result.platform ?? "unknown"] = (acc[result.platform ?? "unknown"] ?? 0) + result.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Response.json({
      message: "Content synced successfully",
      inserted: platformBreakdown,
    } as const satisfies ApiSyncResponse);
  } catch (error: unknown) {
    console.error("Error during sync:", error);
    return Response.json(
      {
        message: "",
        inserted: {},
        error: error instanceof Error ? error.message : "Unknown error during sync",
      } as const satisfies ApiSyncResponse,
      { status: 500 },
    );
  }
};

/* --------------------------------- TWITTER -------------------------------- */
const twitterApiKey = Deno.env.get("TWITTERAPI_API_KEY");
if (!twitterApiKey) throw new Error("TWITTERAPI_API_KEY is not set");

// TwitterAPI allows only fetching latest tweets and going backwards
// So we either fetch from (sync) or until (initial sync) some tweet
export const syncTweets = async (usernames: Array<string>, syncType: "periodic-sync" | "initial-sync") => {
  const synced = await Promise.all(usernames.map((username) => _syncTweets(username, syncType)));
  return synced.reduce((acc, curr) => acc + curr, 0);
};

const _syncTweets = async (username: string, syncType: "periodic-sync" | "initial-sync") => {
  // 1. Get the oldest (initial sync) or latest (sync) tweet id from the database.
  const rows = await sql`
      SELECT t.id
      FROM tw_posts t
      JOIN tw_users a ON t.user_id = a.id
      WHERE a.username = ${username}
      ORDER BY t.id ${syncType === "initial-sync" ? sql`ASC` : sql`DESC`}
      LIMIT 1
    `;
  const limitId: string | undefined = rows[0]?.id; // until this tweet if initial sync, or from this tweet if sync

  // 2. Fetch tweets in batches and insert them into the database
  let nextCursor: string | undefined = "";
  let totalTweetsInserted = 0;

  while (nextCursor !== undefined) {
    let batchTweets: AdvancedSearchResponse["tweets"] = [];

    // Fetch tweets until we reach the batch size or there are no more tweets
    while (nextCursor !== undefined && batchTweets.length < BATCH_SIZE) {
      const query =
        limitId && syncType === "initial-sync"
          ? `from:${username} max_id:${limitId}`
          : limitId && syncType === "periodic-sync"
            ? `from:${username} since_id:${limitId}`
            : `from:${username}`;

      const response = await fetch(
        `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=${query}&cursor=${nextCursor}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": twitterApiKey,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error(`Twitter API error: ${response.statusText}`);

      const data = (await response.json()) as AdvancedSearchResponse;
      batchTweets = [...batchTweets, ...data.tweets];

      if (data.has_next_page) {
        nextCursor = data.next_cursor;
      } else {
        nextCursor = undefined;
      }

      console.log(`Fetched ${batchTweets.length} tweets.`);

      // If we've reached the batch size, break out of the inner loop
      if (batchTweets.length >= BATCH_SIZE) {
        break;
      }
    }

    if (batchTweets.length === 0) break;

    totalTweetsInserted += await insertBatchTweetsAndUsers(batchTweets);
    console.log(`Inserted ${batchTweets.length} tweets. Total: ${totalTweetsInserted}`);
  }

  return totalTweetsInserted;
};

/* -------------------------------- TELEGRAM -------------------------------- */
const telegramApiId = Deno.env.get("TELEGRAM_API_ID");
const telegramApiHash = Deno.env.get("TELEGRAM_API_HASH");
const telegramSession = Deno.env.get("TELEGRAM_SESSION");
if (!telegramApiId || !telegramApiHash) throw new Error("TELEGRAM_API_ID or TELEGRAM_API_HASH is not set");
if (!telegramSession) throw new Error("TELEGRAM_SESSION is not set. Generate a new session with 'pnpm telegram-login'");

const client = new TelegramClient(new StringSession(telegramSession), Number(telegramApiId), telegramApiHash, {
  connectionRetries: 5,
});

export const syncTelegram = async (channels: Array<string>) => {
  const synced = await Promise.all(
    channels.map(async (channel) => {
      await client.connect();

      // 1. Get the channel info
      const rawChannelInfo = await client.invoke(new Api.channels.GetFullChannel({ channel: channel }));
      const rawChatInfo = rawChannelInfo.chats.find((chat) => chat.className === "Channel");
      const channelInfo = {
        id: BigInt(rawChannelInfo.fullChat.id.toString()),
        title: rawChatInfo?.title ?? "",
        about: rawChannelInfo.fullChat.about,
        channel_username: rawChatInfo?.usernames?.[0]?.username ?? "",
        admin_usernames: rawChatInfo?.usernames?.slice(1).map((username) => username.username) ?? [],
      };

      // 2. Get the latest message id from the database for this channel.
      const rows =
        await sql`SELECT id, created_at FROM tg_messages WHERE channel_id = ${channelInfo.id} ORDER BY created_at DESC LIMIT 1`;
      const id: `${string}-${string}` | undefined = rows[0]?.id; // id = channel_id-message_id
      const sinceId = id ? id.split("-")[1] : undefined;

      // 3. Fetch messages from the channel and insert them into the database
      const inserted = await _syncTelegram(channelInfo, sinceId);
      console.log(`Inserted ${inserted} messages for channel ${channelInfo.channel_username}.`);
      return inserted;
    }),
  );
  return synced.reduce((acc, curr) => acc + curr, 0);
};

const _syncTelegram = async (channelInfo: DbTelegramChannel, sinceId: string | undefined) => {
  const iterator = client.iterMessages(channelInfo.channel_username, {
    reverse: true,
    minId: Number(sinceId ?? 0),
  });

  const messages: Array<Omit<DbTelegramMessage, "channel" | "thread_id">> = [];
  for await (const rawMessage of iterator) {
    if (!rawMessage.message) continue; // skip non-text messages

    const channelIdStr = channelInfo.id.toString();
    const messageIdStr = rawMessage.id.toString();
    const replyToMsgIdStr = rawMessage.replyTo?.replyToMsgId?.toString();

    messages.push({
      id: `${channelIdStr}-${messageIdStr}`, // Composite ID: channel_id-message_id
      message_id: BigInt(messageIdStr), // Store the original message_id
      message: rawMessage.message,
      url: `https://t.me/${channelInfo.channel_username}/${messageIdStr}`,
      channel_id: channelInfo.id,
      reply_to_message_id: replyToMsgIdStr ? BigInt(replyToMsgIdStr) : null,
      created_at: new Date(rawMessage.date * 1000).toISOString(),
      urls:
        rawMessage.entities
          ?.filter((entity) => entity.className === "MessageEntityTextUrl" || entity.className === "MessageEntityUrl")
          .map((entity) => {
            const url =
              entity.className === "MessageEntityTextUrl"
                ? entity.url
                : rawMessage.text.slice(entity.offset, entity.offset + entity.length);

            return {
              display_url: url,
              expanded_url: url,
              start_index: entity.offset,
              end_index: entity.offset + entity.length,
            };
          }) ?? null,
      has_media: rawMessage.media?.className === "MessageMediaPhoto",
    });
  }

  console.log(`Fetched ${messages.length} messages for channel ${channelInfo.channel_username}.`);
  return insertBatchTelegramMessagesAndChannel(messages, channelInfo);
};
