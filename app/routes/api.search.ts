import { type LoaderFunctionArgs } from "@remix-run/deno";

import { sql } from "~/lib/db.server.ts";

export async function loader({ request }: LoaderFunctionArgs) {
  // Get the query from URL params
  const url = new URL(request.url);
  const queryText = url.searchParams.get("query");

  if (!queryText) return Response.json({ tweets: [], error: "Missing query parameter" }, { status: 400 });

  try {
    // Execute a single query that:
    // - fetches tweets where text matches the provided query,
    // - also fetches tweets that are the target (reply) of matching tweets,
    // - joins the authors table, and returns unique results.
    // Updated table and column names, added new fields.
    const rows = await sql.query(
      `
      WITH matching AS (
        SELECT id, conversation_id
        FROM tweets
        WHERE text ILIKE $1
      )
      SELECT DISTINCT 
        t.id, 
        t.text, 
        t.created_at,
        t.url,
        t.conversation_id,
        -- Explicitly convert arrays of custom types to JSONB
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
        ) as author
      FROM tweets t 
      JOIN authors a ON t.author_id = a.id 
      WHERE t.id IN (SELECT id FROM matching)
         OR t.conversation_id IN (
              SELECT conversation_id
              FROM matching
              WHERE conversation_id IS NOT NULL
            )
      ORDER BY t.created_at DESC;
      `,
      [`%${queryText}%`],
    );

    return Response.json({ tweets: rows });
  } catch (error: unknown) {
    console.error("Error searching tweets:", error);
    return Response.json(
      { tweets: [], error: error instanceof Error ? error.message : "Unknown error during search" },
      { status: 500 },
    );
  }
}
