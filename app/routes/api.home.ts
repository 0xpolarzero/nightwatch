import { type LoaderFunctionArgs } from "@remix-run/deno";

import { CACHE_TTL, DEFAULT_LIMIT } from "~/lib/constants.server.ts";
import { sql } from "~/lib/db.server.ts";
import { ApiSearchResponse, DbTelegramMessage, DbTweet } from "~/lib/types.ts";

export async function loader({ request }: LoaderFunctionArgs) {
  // Get the limit from URL params
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;

  if (limitParam) {
    const parsedLimit = Number(limitParam);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = parsedLimit;
    }
  }

  // Use a different cache for the home feed
  const cache = await caches.open("home-feed");
  try {
    const cached = await cache.match(request);
    if (cached) {
      console.log(`Cache hit for home feed (limit: ${limit})`);
      cached.headers.set("X-Cache-Status", "HIT");
      return cached;
    }
    console.log(`Cache miss for home feed (limit: ${limit})`);
  } catch (error) {
    console.error("Cache lookup error:", error);
  }

  let response: Response;
  try {
    // Step 1: Get the IDs and types of the latest N items
    const latestItemIds = (await sql`
        WITH latest_items AS (
            SELECT 'tw_post' AS item_type, id::text, created_at FROM tw_posts
            UNION ALL
            SELECT 'tg_message' AS item_type, id, created_at FROM tg_messages
        )
        SELECT id, item_type
        FROM latest_items
        ORDER BY created_at DESC
        LIMIT ${limit};
    `) as Array<{ id: bigint; item_type: "tw_post" | "tg_message" }>;

    // Separate the IDs by type
    const tweetIds = latestItemIds.filter((item) => item.item_type === "tw_post").map((item) => item.id);
    const messageIds = latestItemIds.filter((item) => item.item_type === "tg_message").map((item) => item.id);

    // Step 2: Fetch the full data for those specific IDs
    let tweets: Array<DbTweet> = [];
    if (tweetIds.length > 0) {
      tweets = (await sql`
        SELECT
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
        WHERE t.id = ANY(${tweetIds}) -- Fetch only the specific tweet IDs
        ORDER BY t.created_at DESC; -- Keep ordering consistent if needed
      `) as Array<DbTweet>;
    }

    let tgMessages: Array<DbTelegramMessage> = [];
    if (messageIds.length > 0) {
      tgMessages = (await sql`
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
            jsonb_build_object(
              'id', tc.id,
              'title', tc.title,
              'about', tc.about,
              'channel_username', tc.channel_username,
              'admin_usernames', tc.admin_usernames
            ) as channel
        FROM tg_messages tm
        JOIN tg_channels tc ON tm.channel_id = tc.id
        WHERE tm.id = ANY(${messageIds}) -- Fetch only the specific message IDs
        ORDER BY tm.created_at DESC; -- Keep ordering consistent if needed
      `) as Array<DbTelegramMessage>;
    }

    // Run fetches concurrently
    const results = {
      tweets,
      tgMessages,
    } satisfies ApiSearchResponse;

    response = Response.json(results);
  } catch (error: unknown) {
    console.error("Error fetching latest items:", error);
    return Response.json(
      {
        tweets: [],
        tgMessages: [],
        error: error instanceof Error ? error.message : "Unknown error fetching latest items",
      } as const satisfies ApiSearchResponse,
      { status: 500 },
    );
  }

  // Set cache headers and store in cache
  response.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
  response.headers.set("X-Cache-Status", "MISS");
  try {
    await cache.put(request, response.clone());
    console.log(`Cached home feed response (limit: ${limit})`);
  } catch (cacheError) {
    console.error("Cache put error:", cacheError);
  }

  return response;
}
