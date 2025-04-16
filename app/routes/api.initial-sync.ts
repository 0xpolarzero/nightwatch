import { type LoaderFunctionArgs } from "@remix-run/deno";

import { sync } from "~/lib/sync.server.ts";
import { SyncSource } from "~/lib/types.ts";

export async function action({ request }: LoaderFunctionArgs) {
  // Get the query from URL params
  const url = new URL(request.url);

  // Parse the new format: ?twitter=userA,userB&telegram=channelA,channelB
  const syncs: Array<SyncSource> = [];

  // Add Twitter users to syncs
  const twitterUsers = url.searchParams.get("twitter")?.split(",").filter(Boolean) || [];
  twitterUsers.forEach((username) => syncs.push({ platform: "twitter", username: username.trim() }));

  // Add Telegram channels to syncs
  const telegramChannels = url.searchParams.get("telegram")?.split(",").filter(Boolean) || [];
  telegramChannels.forEach((channel) => syncs.push({ platform: "telegram", channel: channel.trim() }));

  if (!syncs.length) return Response.json({ error: "No sync targets specified" }, { status: 400 });

  return await sync(request, syncs, "initial-sync");
}

// Also support GET requests by redirecting to the action
export function loader({ request }: LoaderFunctionArgs) {
  // For GET requests, we'll just call the action function
  if (request.method === "GET") return action({ request, params: {}, context: {} });
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
