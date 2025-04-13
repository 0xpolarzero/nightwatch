import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  // Get the query from URL params
  const searchParams = request.nextUrl.searchParams;
  const queryText = searchParams.get("query");

  if (!queryText) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    // Execute a single query that:
    // - fetches tweets where text matches the provided query,
    // - also fetches tweets that are the target (reply) of matching tweets,
    // - joins the author table, and returns unique results.
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
        t.author_id, 
        t.conversation_id, 
        a.username, 
        a.name
      FROM tweets t
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

    return NextResponse.json({ tweets: rows });
  } catch (error: any) {
    console.error("Error searching tweets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Specify Node.js runtime for this API route
export const runtime = "nodejs";
