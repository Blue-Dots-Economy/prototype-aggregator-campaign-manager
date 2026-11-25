import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export type { Seeker } from "./my-blue-dots-live.model";

// Single server call: the handler pages through the source DB and returns the aggregated instance.
export const fetchMyBlueDotsLive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    instance: z.enum(["UP", "KA"]).default("UP"),
  }).parse(input))
  .handler(async ({ data }) => {
    const { loadLiveInstance } = await import("./my-blue-dots-live.server");
    return loadLiveInstance(data);
  });

// Compatibility for the launch audience's existing loader; no CSV or callable PII fallback.
export const loadSeekersAsync = () => fetchMyBlueDotsLive({ data: { instance: "UP" } });
