import { type LoaderFunctionArgs } from "@remix-run/deno";

import { CACHE_TTL } from "~/lib/constants.server.ts";
import { sql } from "~/lib/db.server.ts";
import { ApiSearchResponse, DbTelegramMessage } from "~/lib/types.ts";

export async function loader({ request }: LoaderFunctionArgs) {
  // Get the query from URL params
  const url = new URL(request.url);
  const queryText = url.searchParams.get("query");

  if (!queryText) {
    // Return a valid Response object for errors
    return Response.json({ tweets: [], tgMessages: [], error: "Missing query parameter" } satisfies ApiSearchResponse, {
      status: 400,
    });
  }

  // Try to get from cache first
  const cache = await caches.open("search-results");
  try {
    const cached = await cache.match(request);
    if (cached) {
      console.log(`Cache hit for query: "${queryText}"`);
      cached.headers.set("X-Cache-Status", "HIT");
      return cached;
    }

    console.log(`Cache miss for query: "${queryText}"`);
  } catch (error) {
    console.error("Cache lookup error:", error);
  }

  let response: Response;
  try {
    // Query 1: Tweets using FTS
    const tweetsPromise = sql`
      WITH matching AS (
        SELECT id, conversation_id
        FROM tw_posts
        WHERE fts_tokens @@ websearch_to_tsquery('english', ${queryText})
      )
      SELECT DISTINCT ON (t.id)
        t.id,
        t.text,
        t.created_at,
        t.url,
        t.conversation_id,
        to_jsonb(t.user_mentions) as user_mentions,
        to_jsonb(t.urls) as urls,
        to_jsonb(t.medias) as medias,
        jsonb_build_object(
          'id', a.id,
          'username', a.username,
          'display_name', a.display_name,
          'profile_picture_url', a.profile_picture_url,
          'followers', a.followers,
          'following', a.following,
          'profile_bio', a.profile_bio
        ) as user
      FROM tw_posts t
      JOIN tw_users a ON t.user_id = a.id
      WHERE t.id IN (SELECT id FROM matching)
         OR t.conversation_id IN (
              SELECT conversation_id
              FROM matching
              WHERE conversation_id IS NOT NULL
            )
      ORDER BY t.id, t.created_at DESC;
    `;

    // Query 2: Telegram messages - Refactored to use thread_id
    const tgMessagesPromise = (async (): Promise<DbTelegramMessage[]> => {
      // Step 2.1: Find distinct thread_ids containing messages matching the FTS query.
      // We only need the thread_id from messages that actually have one.
      const matchingThreads = await sql`
        SELECT DISTINCT thread_id
        FROM tg_messages
        WHERE thread_id IS NOT NULL
          AND fts_tokens @@ websearch_to_tsquery('english', ${queryText});
      `;

      // Extract the unique thread IDs. If none found, return early.
      const threadIds = matchingThreads.map((m) => m.thread_id);
      if (threadIds.length === 0) {
        console.log(`No matching Telegram threads found for query: "${queryText}"`);
        return []; // No matching threads found
      }

      console.log(`Found ${threadIds.length} matching Telegram threads for query: "${queryText}"`);

      // Step 2.2: Fetch all messages belonging to these threads, joining channel info.
      // Order by creation date to allow chronological display on the frontend.
      const messagesInThreads = await sql`
        SELECT
            tm.id,
            tm.message_id,
            tm.message,
            tm.url,
            tm.created_at,
            tm.views,
            tm.channel_id,
            tm.reply_to_message_id,
            to_jsonb(tm.urls) as urls,
            tm.has_media,
            tm.thread_id,
            -- Construct the channel object directly
            jsonb_build_object(
              'id', tc.id,
              'title', tc.title,
              'about', tc.about,
              'channel_username', tc.channel_username,
              'admin_usernames', tc.admin_usernames
            ) as channel
        FROM tg_messages tm
        JOIN tg_channels tc ON tm.channel_id = tc.id
        WHERE tm.thread_id = ANY(${threadIds})
        ORDER BY tm.created_at ASC;
      `;

      console.log(`Fetched ${messagesInThreads.length} messages from matching threads for query: "${queryText}"`);
      return messagesInThreads as Array<DbTelegramMessage>;
    })();

    const [tweetsResult, tgMessagesResult] = await Promise.all([tweetsPromise, tgMessagesPromise]);
    const results = {
      tweets: tweetsResult,
      tgMessages: tgMessagesResult,
    } as ApiSearchResponse;

    response = Response.json(results);
  } catch (error: unknown) {
    console.error("Error searching sources:", error);
    return Response.json(
      {
        tweets: [],
        tgMessages: [],
        error: error instanceof Error ? error.message : "Unknown error during search",
      } as const satisfies ApiSearchResponse,
      { status: 500 },
    );
  }

  // Set cache headers and store in cache
  response.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
  response.headers.set("X-Cache-Status", "MISS");
  try {
    await cache.put(request, response.clone());
    console.log(`Cached responses for query: "${queryText}"`);
  } catch (cacheError) {
    console.error("Cache put error:", cacheError);
  }

  return response;
}
