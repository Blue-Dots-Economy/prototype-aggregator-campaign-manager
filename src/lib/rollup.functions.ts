import { createServerFn } from "@tanstack/react-start";
import type { DistrictRollup, RollupOrg, RollupStats } from "./rollup.model";

export type { DistrictRollup, RollupOrg, RollupCoordinator, RollupMember, RollupStats } from "./rollup.model";

export const fetchDistrictRollup = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; aggregatorId?: string | null; coordinatorId?: string | null; offset?: number }) => ({
    instance: d.instance === "KA" ? "KA" : d.instance === "UP" ? "UP" : "",
    aggregatorId: typeof d.aggregatorId === "string" && d.aggregatorId.length <= 150 ? d.aggregatorId : null,
    coordinatorId: typeof d.coordinatorId === "string" && d.coordinatorId.length <= 150 ? d.coordinatorId : null,
    offset: Number.isSafeInteger(d.offset) && (d.offset ?? 0) >= 0 ? d.offset ?? 0 : 0,
  }))
  .handler(async ({ data }): Promise<DistrictRollup> => {
    if (!data.instance) return { available: false };
    const { loadDistrictRollup } = await import("./rollup.server");
    return loadDistrictRollup(data.instance, data.aggregatorId, data.offset, data.coordinatorId);
  });

/** Stats for the active participant view (all = seekers + providers). */
export function statsFor(o: Pick<RollupOrg, "seekers" | "providers">, view: "all" | "seeker" | "provider"): RollupStats {
  if (view === "seeker") return o.seekers;
  if (view === "provider") return o.providers;
  const a = o.seekers, b = o.providers;
  return { dots: a.dots + b.dots, new7d: a.new7d + b.new7d, active: a.active + b.active, atRisk: a.atRisk + b.atRisk, inactive: a.inactive + b.inactive, applied: a.applied + b.applied };
}
export const isOrgId = (s?: string | null) => !!s && /^org_[0-9a-f-]+$/i.test(s);
