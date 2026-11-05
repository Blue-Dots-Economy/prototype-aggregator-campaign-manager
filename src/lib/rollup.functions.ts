import { createServerFn } from "@tanstack/react-start";
import type { DistrictRollup } from "./rollup.model";

export type { DistrictRollup, RollupOrg, RollupCoordinator, RollupMember, RollupStats } from "./rollup.model";
export { statsFor } from "./rollup.model";

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

export const isOrgId = (s?: string | null) => !!s && /^org_[0-9a-f-]+$/i.test(s);
