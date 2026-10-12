import { createServerFn } from "@tanstack/react-start";
import type { DistrictRollup, RollupOrg, RollupStats } from "./rollup.server";

export type { DistrictRollup, RollupOrg, RollupMember, RollupStats } from "./rollup.server";

export const fetchDistrictRollup = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; aggregatorId?: string | null }) => ({
    instance: d.instance === "KA" ? "KA" : d.instance === "UP" ? "UP" : "",
    aggregatorId: typeof d.aggregatorId === "string" && /^org_[0-9a-f-]+$/i.test(d.aggregatorId) ? d.aggregatorId : null,
  }))
  .handler(async ({ data }): Promise<DistrictRollup> => {
    if (!data.instance) return { available: false };
    const { loadDistrictRollup } = await import("./rollup.server");
    return loadDistrictRollup(data.instance, data.aggregatorId);
  });

/** Stats for the active participant view (all = seekers + providers). */
export function statsFor(o: RollupOrg, view: "all" | "seeker" | "provider"): RollupStats {
  if (view === "seeker") return o.seekers;
  if (view === "provider") return o.providers;
  const a = o.seekers, b = o.providers;
  return { dots: a.dots + b.dots, new7d: a.new7d + b.new7d, active: a.active + b.active, atRisk: a.atRisk + b.atRisk, inactive: a.inactive + b.inactive, applied: a.applied + b.applied };
}
export const isOrgId = (s?: string | null) => !!s && /^org_[0-9a-f-]+$/i.test(s);
