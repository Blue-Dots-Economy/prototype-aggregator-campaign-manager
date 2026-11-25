import { createServerFn } from "@tanstack/react-start";
import type { ScopedSeekers } from "./scoped-seekers.server";
export type { ScopedSeekers, ScopedSeekerRow } from "./scoped-seekers.server";

export const fetchScopedSeekers = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; coordinatorId: string }) => {
    if (!["UP", "KA"].includes(d.instance) || typeof d.coordinatorId !== "string" || !d.coordinatorId || d.coordinatorId.length > 150) throw new Error("Invalid seeker scope");
    return { instance: d.instance, coordinatorId: d.coordinatorId };
  })
  .handler(async ({ data }): Promise<ScopedSeekers> => {
    const { blueDotsScope } = await import("./blue-dots-auth.server");
    const scoped = await blueDotsScope({ instance: data.instance, coordinatorId: data.coordinatorId });
    if (scoped.aggregatorId) throw new Error("Unauthorized");
    if (scoped.coordinatorId && scoped.coordinatorId !== data.coordinatorId) throw new Error("Unauthorized");
    const { loadScopedSeekers } = await import("./scoped-seekers.server");
    return loadScopedSeekers(scoped.instance, data.coordinatorId);
  });
