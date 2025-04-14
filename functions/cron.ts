export interface Env {
  CRON_SECRET: string;
  API_URL: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("Running scheduled sync job");

    try {
      const response = await fetch(`${env.API_URL}/api/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to sync tweets: ${response.status} ${text}`);
      }

      const result = await response.json();
      console.log("Sync completed successfully:", result);
    } catch (error) {
      console.error("Error in cron job:", error);
    }
  },
};
