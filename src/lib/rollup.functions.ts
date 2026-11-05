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
    const { blueDotsScope } = await import("./blue-dots-auth.server");
    const scoped = await blueDotsScope(data);
    const { loadDistrictRollup } = await import("./rollup.server");
    return loadDistrictRollup(scoped.instance, scoped.aggregatorId, data.offset, scoped.coordinatorId);
  });

export const syncBlueDots = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; aggregatorId?: string; coordinatorId?: string }) => d)
  .handler(async ({ data }) => {
    const { blueDotsScope } = await import("./blue-dots-auth.server");
    await blueDotsScope(data);
    const { performBlueDotsSync } = await import("./blue-dots-sync.server");
    return performBlueDotsSync();
  });

export const fetchArmMembers = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string; orgId?: string; coordinatorId?: string; kind: "all" | "seeker" | "provider" }) => {
    if (!["UP", "KA"].includes(d.instance) || !["all", "seeker", "provider"].includes(d.kind) || (d.orgId?.length ?? 0) > 150 || (d.coordinatorId?.length ?? 0) > 150) throw new Error("Invalid participant scope");
    return d;
  })
  .handler(async ({ data }) => {
    const { blueDotsScope } = await import("./blue-dots-auth.server");
    const scoped = await blueDotsScope({ instance: data.instance, aggregatorId: data.orgId, coordinatorId: data.coordinatorId });
    const { loadArmMembers } = await import("./rollup.server");
    return loadArmMembers({ ...scoped, kind: data.kind });
  });

export const isOrgId = (s?: string | null) => !!s && /^org_[0-9a-f-]+$/i.test(s);
