import { SyncSource } from "~/lib/types.ts";

export const RELEVANT_SOURCES = [
  { platform: "twitter", username: "zachxbt" },
  { platform: "telegram", channel: "investigations" },
] as const satisfies Array<SyncSource>;
export const BATCH_SIZE = 200;
export const ABORT_DELAY = 10_000;
export const CACHE_TTL = 3_600; // 1 hour
