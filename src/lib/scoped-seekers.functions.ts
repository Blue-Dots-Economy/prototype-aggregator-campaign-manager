import { createServerFn } from "@tanstack/react-start";
import type { ScopedSeekers, FieldCompletion } from "./scoped-seekers.server";
export type { ScopedSeekers, ScopedSeekerRow, FieldCompletion } from "./scoped-seekers.server";

export const fetchScopedSeekers = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; coordinatorId: string; from?: string | null; to?: string | null; source?: string | null }) => {
    if (!["UP", "KA"].includes(d.instance) || typeof d.coordinatorId !== "string" || !d.coordinatorId || d.coordinatorId.length > 150) throw new Error("Invalid seeker scope");
    return { instance: d.instance, coordinatorId: d.coordinatorId, from: typeof d.from === "string" && d.from.length <= 40 && Number.isFinite(new Date(d.from).getTime()) ? d.from : null, to: typeof d.to === "string" && d.to.length <= 40 && Number.isFinite(new Date(d.to).getTime()) ? d.to : null, source: ["voice", "qr", "bulk", "self"].includes(d.source ?? "") ? d.source ?? null : null };
  })
  .handler(async ({ data }): Promise<ScopedSeekers> => {
    const { blueDotsScope } = await import("./blue-dots-auth.server");
    const scoped = await blueDotsScope({ instance: data.instance, coordinatorId: data.coordinatorId });
    if (scoped.aggregatorId) throw new Error("Unauthorized");
    if (scoped.coordinatorId && scoped.coordinatorId !== data.coordinatorId) throw new Error("Unauthorized");
    const { loadScopedSeekers } = await import("./scoped-seekers.server");
    return loadScopedSeekers(scoped.instance, data.coordinatorId, data.from, data.to, data.source);
  });

export const fetchFieldCompletion = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; coordinatorId: string; from?: string | null; to?: string | null; source?: string | null }) => {
    if (!["UP", "KA"].includes(d.instance) || typeof d.coordinatorId !== "string" || !d.coordinatorId || d.coordinatorId.length > 150) throw new Error("Invalid scope");
    return { instance: d.instance, coordinatorId: d.coordinatorId, from: typeof d.from === "string" && d.from.length <= 40 && Number.isFinite(new Date(d.from).getTime()) ? d.from : null, to: typeof d.to === "string" && d.to.length <= 40 && Number.isFinite(new Date(d.to).getTime()) ? d.to : null, source: ["voice", "qr", "bulk", "self"].includes(d.source ?? "") ? d.source ?? null : null };
  })
  .handler(async ({ data }): Promise<FieldCompletion> => {
    const { blueDotsScope } = await import("./blue-dots-auth.server");
    const scoped = await blueDotsScope({ instance: data.instance, coordinatorId: data.coordinatorId });
    if (scoped.aggregatorId) throw new Error("Unauthorized");
    if (scoped.coordinatorId && scoped.coordinatorId !== data.coordinatorId) throw new Error("Unauthorized");
    const { loadFieldCompletion } = await import("./scoped-seekers.server");
    return loadFieldCompletion(scoped.instance, data.coordinatorId, data.from, data.to, data.source);
  });
