import { sql } from "~/lib/db.server";

export async function loader() {
  try {
    // Test the database connection
    const dbResult = await sql`SELECT NOW() as time`;

    // Check if Twitter API key is configured
    const twitterApiConfigured = Boolean(process.env.TWITTERAPI_API_KEY);

    return Response.json({
      status: "ok",
      message: "API is healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
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
          databaseConfigured: Boolean(process.env.NEON_DATABASE_URL),
          databaseConnected: false,
          twitterApiConfigured: Boolean(process.env.TWITTERAPI_API_KEY),
        },
      },
      { status: 500 },
    );
  }
}
