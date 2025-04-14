import { type ActionFunctionArgs } from "@remix-run/node";
import { RELEVANT_USERS } from "~/lib/constants";
import { sql } from "~/lib/db.server";
import { AdvancedSearchResponse, Author } from "~/lib/types";

const twitterApiKey = process.env.TWITTERAPI_API_KEY;
if (!twitterApiKey) throw new Error("TWITTERAPI_API_KEY is not set");

export async function action({ request }: ActionFunctionArgs) {
  // Verify the request is from a cron job or has proper authorization
  const cronSecret = process.env.CRON_SECRET;
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
    const BATCH_SIZE = 200;

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

      // Process this batch of tweets
      // 3. Insert users into the database.
      const authors = batchTweets.reduce(
        (acc, tweet) => {
          acc[tweet.author.id] = {
            id: Number(tweet.author.id),
            username: tweet.author.userName,
            name: tweet.author.name,
            profile_picture_url: tweet.author.profilePicture,
          };
          return acc;
        },
        {} as Record<string, Author>,
      );

      const authorValues = Object.values(authors).map((author) => [
        author.id,
        author.username,
        author.name,
        author.profile_picture_url,
      ]);

      await sql.query(
        `
      INSERT INTO author (id, username, name, profile_picture_url)
      VALUES ${authorValues.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(",")}
      ON CONFLICT (id) DO NOTHING`,
        authorValues.flat(),
      );

      // 4. Insert new tweets into the database.
      const tweetValues = batchTweets.map((tweet) => [
        tweet.id,
        tweet.text,
        tweet.author.id,
        tweet.createdAt,
        tweet.conversationId || null,
        tweet.url,
      ]);

      await sql.query(
        `
      INSERT INTO tweet (id, text, author_id, created_at, conversation_id, url)
      VALUES ${tweetValues.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(",")}
      ON CONFLICT (id) DO NOTHING`,
        tweetValues.flat(),
      );

      totalTweetsInserted += batchTweets.length;
      console.log(`Inserted batch of ${batchTweets.length} tweets. Total: ${totalTweetsInserted}`);
    }

    if (totalTweetsInserted === 0) {
      return Response.json({ message: "No new tweets found" }, { status: 200 });
    }

    return Response.json({
      message: "Tweets updated successfully",
      inserted: totalTweetsInserted,
    });
  } catch (error: any) {
    console.error("Error updating tweets:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Also support GET requests by redirecting to the action
export async function loader({ request }: ActionFunctionArgs) {
  // For GET requests, we'll just call the action function
  if (request.method === "GET") return action({ request, params: {}, context: {} });
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
