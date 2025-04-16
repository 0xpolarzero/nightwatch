import { type LoaderFunctionArgs } from "@remix-run/deno";

import { RELEVANT_SOURCES } from "~/lib/constants.server.ts";
import { sync } from "~/lib/sync.server.ts";

const twitterApiKey = Deno.env.get("TWITTERAPI_API_KEY");
if (!twitterApiKey) throw new Error("TWITTERAPI_API_KEY is not set");

export async function action({ request }: LoaderFunctionArgs) {
  return await sync(request, RELEVANT_SOURCES, "periodic-sync");
}

// Also support GET requests by redirecting to the action
export function loader({ request }: LoaderFunctionArgs) {
  // For GET requests, we'll just call the action function
  if (request.method === "GET") return action({ request, params: {}, context: {} });
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
