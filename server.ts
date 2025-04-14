import { createRequestHandlerWithStaticFiles } from "@remix-run/deno";

// Import the server build from Remix
import * as build from "./build/index.js";

// --- Cron Job Logic ---
async function runSyncJob() {
  console.log("Running scheduled sync job via Deno Cron");
  const apiUrl = Deno.env.get("API_URL"); // Deno Deploy automatically sets this to your deployment URL
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!apiUrl || !cronSecret) {
    console.error("API_URL or CRON_SECRET environment variables not set for cron job.");
    return;
  }

  try {
    // Use the internal URL for potentially better performance/reliability
    const syncUrl = new URL("/api/sync", apiUrl).toString();
    console.log(`Calling sync endpoint: ${syncUrl}`);

    const response = await fetch(syncUrl, {
      method: "POST", // Or GET if you prefer using the loader defined in api.sync.ts
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json", // Keep even if no body for POST
        // Add header to indicate it's a cron call if needed for logging/logic
        "X-Deno-Cron": "true",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to sync tweets: ${response.status} ${text}`);
    }

    const result = await response.json();
    console.log("Deno Cron sync completed successfully:", result);
  } catch (error) {
    console.error("Error in Deno Cron job:", error);
  }
}

// Define the cron schedule (e.g., every 6 hours)
// See https://deno.com/deploy/docs/cron
Deno.cron("tweet-sync", "0 */6 * * *", runSyncJob);
// --- End Cron Job Logic ---

// Create the Remix request handler
const remixHandler = createRequestHandlerWithStaticFiles({
  build,
  mode: Deno.env.get("NODE_ENV") === "development" ? "development" : "production",
  // Define the directory for serving static assets (like CSS, JS)
  staticFiles: {
    publicDir: "./public/build",
  },
});

// Get the port from the environment (Deno Deploy sets this)
const port = Number(Deno.env.get("PORT")) || 8000;

console.log(`Remix server starting on http://localhost:${port}`);

// Start the Deno HTTP server
Deno.serve({ port }, remixHandler);
