import { type LoaderFunctionArgs } from "@remix-run/node";
import { sql } from "~/lib/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Get the query from URL params
  const url = new URL(request.url);
  const queryText = url.searchParams.get("query");

  if (!queryText) return Response.json({ error: "Missing query parameter" }, { status: 400 });

  try {
    // Execute a single query that:
    // - fetches tweets where text matches the provided query,
    // - also fetches tweets that are the target (reply) of matching tweets,
    // - joins the author table, and returns unique results.
    const rows = await sql.query(
      `
      WITH matching AS (
        SELECT id, conversation_id
        FROM tweet
        WHERE text ILIKE $1
      )
      SELECT DISTINCT 
        t.id, 
        t.text, 
        t.created_at,
        t.url,
        t.conversation_id, 
        jsonb_build_object(
          'id', a.id,
          'username', a.username,
          'name', a.name,
          'profile_picture_url', a.profile_picture_url
        ) as author
      FROM tweet t
      JOIN author a ON t.author_id = a.id
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
  } catch (error: any) {
    console.error("Error searching tweets:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
