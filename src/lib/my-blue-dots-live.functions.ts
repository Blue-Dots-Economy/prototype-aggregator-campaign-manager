import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { summarizeSeekers, type Seeker } from "./my-blue-dots-live.model";
export type { Seeker } from "./my-blue-dots-live.model";

export const fetchMyBlueDotsLive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    instance: z.enum(["UP", "KA"]).default("UP"),
    after: z.string().max(256).nullable().default(null),
    asOf: z.string().datetime().nullable().default(null),
  }).parse(input))
  .handler(async ({ data }) => {
    const { loadLiveProfileSlice } = await import("./my-blue-dots-live.server");
    return loadLiveProfileSlice(data);
  });

// Shared client-side stitching: never return an entire table through one server response.
export async function loadLiveSeekers(
  fetchSlice: (input: { data: { instance: "UP" | "KA"; after: string | null; asOf: string | null } }) => ReturnType<typeof fetchMyBlueDotsLive>,
  instance: "UP" | "KA" = "UP",
  signal?: AbortSignal,
) {
  const seekers: Seeker[] = [];
  let after: string | null = null, asOf: string | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const page = await fetchSlice({ data: { instance, after, asOf } });
    signal?.throwIfAborted();
    asOf = page.asOf;
    seekers.push(...page.seekers);
    if (page.nextCursor === null) break;
    if (page.nextCursor === after) throw new Error("Live profile pagination did not advance.");
    after = page.nextCursor;
  }
  return { seekers, summary: summarizeSeekers(seekers), asOf };
}

// Compatibility for the launch audience's existing loader; no CSV or callable PII fallback.
export const loadSeekersAsync = () => loadLiveSeekers(fetchMyBlueDotsLive);