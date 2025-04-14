import { type LoaderFunctionArgs } from "@remix-run/deno";

import { BATCH_SIZE, RELEVANT_USERS } from "~/lib/constants.server.ts";
import { sql } from "~/lib/db.server.ts";
import { insertBatchTweetsAndAuthors } from "~/lib/sql.server.ts";
import { AdvancedSearchResponse } from "~/lib/types.ts";

const twitterApiKey = Deno.env.get("TWITTERAPI_API_KEY");
if (!twitterApiKey) throw new Error("TWITTERAPI_API_KEY is not set");

export async function action({ request }: LoaderFunctionArgs) {
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
    // 1. Get the latest tweet id from the database.
    const rows = await sql`SELECT id, created_at FROM tweet ORDER BY created_at DESC LIMIT 1`;
    const sinceId: string | undefined = rows[0]?.id;

    // 2. Fetch tweets in batches and insert them into the database
    let nextCursor: string | undefined = "";
    let totalTweetsInserted = 0;

    while (nextCursor !== undefined) {
      let batchTweets: AdvancedSearchResponse["tweets"] = [];

      // Fetch tweets until we reach the batch size or there are no more tweets
      while (nextCursor !== undefined && batchTweets.length < BATCH_SIZE) {
        const query = sinceId
          ? `from:${RELEVANT_USERS.join(" OR ")} since_id:${sinceId}`
          : `from:${RELEVANT_USERS.join(" OR ")}`;

        const response = await fetch(
          `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=${query}&cursor=${nextCursor}`,
          {
            method: "GET",
            // @ts-expect-error - no headers parameter
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

      totalTweetsInserted += await insertBatchTweetsAndAuthors(batchTweets);
      console.log(`Inserted ${totalTweetsInserted} tweets.`);
    }

    if (totalTweetsInserted === 0) {
      return Response.json({ message: "No new tweets found" }, { status: 200 });
    }

    return Response.json({
      message: "Tweets updated successfully",
      inserted: totalTweetsInserted,
    });
  } catch (error: unknown) {
    console.error("Error updating tweets:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error during tweet update" },
      { status: 500 },
    );
  }
}

// Also support GET requests by redirecting to the action
export function loader({ request }: LoaderFunctionArgs) {
  // For GET requests, we'll just call the action function
  if (request.method === "GET") return action({ request, params: {}, context: {} });
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
