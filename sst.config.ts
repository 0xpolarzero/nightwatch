/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  /** Configure the application */
  app() {
    return {
      name: "sleuth", // Your application's name
      home: "cloudflare", // Set Cloudflare as the deployment target and state backend
      providers: {
        cloudflare: {
          apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
        },
      },
    };
  },
  /** Define the application's infrastructure */
  async run() {
    // Define the main Remix application deployed to Cloudflare Workers
    // This component handles building the Remix app for the Cloudflare Workers runtime
    const site = new sst.cloudflare.Remix("Site", {
      // Optional: Configure a custom domain
      // domain: "your-domain.com", // Requires DNS setup, see SST docs
      // Define server-side environment variables for the Remix app
      environment: {
        // These are accessible ONLY in Remix loaders and actions (server-side)
        NEON_DATABASE_URL: process.env.NEON_DATABASE_URL ?? "",
        TWITTERAPI_API_KEY: process.env.TWITTERAPI_API_KEY ?? "",
        CRON_SECRET: process.env.CRON_SECRET ?? "", // Secret for cron job authorization
      },
      // No 'path' or 'handler' needed here; sst.cloudflare.Remix assumes project root ('.')
    });

    // Define the separate Cloudflare Worker for the cron job
    const cronWorker = new sst.cloudflare.Cron("Cron", {
      // Define the job as an object to include environment variables
      job: {
        // Specify the handler file for the cron worker code
        handler: "functions/cron.ts",
        // Define environment variables needed by the cron worker
        environment: {
          // Pass the deployed URL of the main Remix site to the cron worker
          // site.url provides the live URL after deployment
          API_URL: site.url.get() ?? "",
          // Pass the same CRON_SECRET for authorization
          CRON_SECRET: process.env.CRON_SECRET ?? "",
        },
      },
      // Define the cron schedule (e.g., every 6 hours)
      schedules: ["0 */6 * * *"],
    });

    // Output the URLs after deployment
    return {
      siteUrl: site.url,
      // Output the URN (Uniform Resource Name) for the cron worker for identification
      cronWorkerUrn: cronWorker.urn,
    };
  },
});
