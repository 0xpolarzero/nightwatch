import { neon, neonConfig } from "@neondatabase/serverless";

// Enable WebSocket pooling for better performance with serverless functions
if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

// Get the database connection string from environment variables
const neonDatabaseUrl = Deno.env.get("NEON_DATABASE_URL");
if (!neonDatabaseUrl) throw new Error("NEON_DATABASE_URL is not set");

// Create and export the SQL client
export const sql = neon(neonDatabaseUrl);
