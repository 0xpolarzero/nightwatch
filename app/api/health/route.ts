import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Test the database connection
    const dbResult = await sql`SELECT NOW() as time`;

    // Check if Twitter API key is configured
    const twitterApiConfigured = Boolean(process.env.TWITTERAPI_API_KEY);

    return NextResponse.json({
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
    return NextResponse.json(
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

// Add a HEAD handler for health checks
export async function HEAD(request: NextRequest) {
  try {
    await sql`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}

// Specify Node.js runtime for this API route
export const runtime = "nodejs";
