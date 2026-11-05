import { describe, expect, it } from "vitest";
import { rollupFromCounts, resolveAggregator, statsFor, type ArmCounts } from "./rollup.model";

const arm = (id: string, type: string, counts: Partial<ArmCounts> = {}): ArmCounts => ({ org_id: "jfc", org_name: "Joint Facilitation Centre Ghaziabad - JFC", coordinator_org_id: id, coordinator_org_name: "Joint Facilitation Centre Ghaziabad - JFC", coordinator_type: type, s_total: 0, s_new: 0, s_active: 0, s_at_risk: 0, s_inactive: 0, s_applied: 0, p_total: 0, p_new: 0, p_active: 0, p_inactive: 0, p_live_postings: 0, ...counts });
const rows = [arm("seeker-arm", "seeker", { s_total: 1381, s_new: 3, s_active: 2, s_at_risk: 83, s_inactive: 1293, s_applied: 85 }), arm("provider-arm", "provider", { p_total: 27, p_inactive: 27 }), arm("service-arm", "service_provider")];
describe("count-only mirror hierarchy", () => {
  it("preserves JFC All 1408", () => { expect(statsFor(rollupFromCounts(rows)[0], "all").dots).toBe(1408); });
  it("preserves JFC seekers 1381", () => { expect(statsFor(rollupFromCounts(rows)[0], "seeker").dots).toBe(1381); });
  it("preserves JFC providers 27", () => { expect(statsFor(rollupFromCounts(rows)[0], "provider").dots).toBe(27); });
  it("preserves mutually exclusive lifecycle counts", () => { expect(statsFor(rollupFromCounts(rows)[0], "all")).toMatchObject({ new7d: 3, active: 2, atRisk: 83, inactive: 1320 }); });
  it("retains empty registered arms", () => { expect(rollupFromCounts(rows)[0].coordinators).toHaveLength(3); });
  it("disambiguates names only within the same parent", () => { const result = rollupFromCounts([...rows, { ...arm("other-arm", "provider"), org_id: "other" }]); expect(result[0].coordinators[0].name).toBe("Joint Facilitation Centre Ghaziabad - JFC (seeker)"); expect(result[1].coordinators[0].name).toBe("Joint Facilitation Centre Ghaziabad - JFC"); });
  it("resolves owner by parent or arm ID", () => { const orgs = rollupFromCounts(rows); expect(resolveAggregator(orgs, "provider-arm")).toEqual(resolveAggregator(orgs, "jfc")); });
  it("does not include member IDs in initial counts", () => { const org = rollupFromCounts(rows)[0]; expect(org.members).toEqual([]); expect(org.coordinators.every(c => c.members.length === 0)).toBe(true); });
  it("includes new providers with postings in applied without making them Active", () => { const org = rollupFromCounts([arm("p", "provider", { p_total: 2, p_new: 1, p_active: 1, p_applied: 2, p_live_postings: 3 })])[0]; expect(org.providers).toMatchObject({ new7d: 1, active: 1, applied: 2 }); });
});