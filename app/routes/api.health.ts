import { sql } from "~/lib/db.server";

export async function loader() {
  try {
    // Test the database connection
    const dbResult = await sql`SELECT NOW() as time`;

    // Check if Twitter API key is configured
    const twitterApiConfigured = Boolean(Deno.env.get("TWITTERAPI_API_KEY"));

    return Response.json({
      status: "ok",
      message: "API is healthy",
      timestamp: new Date().toISOString(),
      environment: Deno.env.get("NODE_ENV") || "development",
      checks: {
        databaseConfigured: true,
        databaseConnected: Boolean(dbResult && dbResult.length > 0),
        twitterApiConfigured,
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        status: "error",
        message: error.message,
        checks: {
          databaseConfigured: Boolean(Deno.env.get("NEON_DATABASE_URL")),
          databaseConnected: false,
          twitterApiConfigured: Boolean(Deno.env.get("TWITTERAPI_API_KEY")),
        },
      },
      { status: 500 },
    );
  }
}
