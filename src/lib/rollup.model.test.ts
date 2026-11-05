import { describe, expect, it } from "vitest";
import { buildRollup, resolveAggregator, type AggregatorRow, type UserRow } from "./rollup.model";
const now = Date.parse("2026-11-04T19:47:00Z");
const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();
const arm = (id: string, type = "seeker", parent = "parent", name = "Institution"): AggregatorRow => ({ org_id: parent, org_name: name, coordinator_org_id: id, coordinator_org_name: null, coordinator_type: type, test_flag: false });
const user = (id: string, coord: string, kind = "seeker", age = 100): UserRow => ({ id, onboarded_by_org_id: coord, domains: [kind], created_at: daysAgo(age) });
describe("real Blue Dots hierarchy", () => {
  it("uses the trimmed coordinator organisation name and retains type metadata", () => {
    const coord = buildRollup([{ ...arm("a"), coordinator_org_name: "  JFC Seeker Arm  " }], [], [], [], now)[0].coordinators[0];
    expect(coord.name).toBe("JFC Seeker Arm");
    expect(coord.type).toBe("seeker");
    expect(coord.typeLabel).toBe("Seeker unit");
  });
  it("falls back to the existing type only for null or blank arm names", () => {
    const coords = buildRollup([arm("a"), { ...arm("b", "provider"), coordinator_org_name: "   " }], [], [], [], now)[0].coordinators;
    expect(coords.map(c => c.name)).toEqual(["Seeker unit", "Provider unit"]);
  });
  it("suffixes every colliding name with its type, leaving unique names unchanged", () => {
    const name = "Joint Facilitation Centre Ghaziabad - JFC";
    const arms = ["seeker", "provider", "service_provider"].map(type => ({ ...arm(type, type), coordinator_org_name: name }));
    arms.push({ ...arm("unique"), coordinator_org_name: "Independent arm" });
    const coords = buildRollup(arms, [], [], [], now)[0].coordinators;
    expect(coords.map(c => c.name)).toEqual([`${name} (seeker)`, `${name} (provider)`, `${name} (service_provider)`, "Independent arm"]);
  });
  it("does not disambiguate names across different parent organisations", () => {
    const arms = ["one", "two"].map(parent => ({ ...arm(parent, "seeker", parent), coordinator_org_name: "Shared arm name" }));
    expect(buildRollup(arms, [], [], [], now).map(o => o.coordinators[0].name)).toEqual(["Shared arm name", "Shared arm name"]);
  });
  it("combines arms by parent ID with unsuffixed institutional names and exact unit labels", () => {
    const orgs = buildRollup([arm("a"), arm("b", "provider"), arm("c", "service_provider")], [user("u", "a"), user("p", "b", "provider")], [], [], now);
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("Institution");
    expect(orgs[0].coordinators.map(c => c.typeLabel)).toEqual(["Seeker unit", "Provider unit", "Service-provider unit"]);
    expect(orgs[0].seekers.dots).toBe(1);
    expect(orgs[0].providers.dots).toBe(1);
    expect(orgs[0].coordinators[0].members[0].id).toBe("u");
  });
  it("resolves an owner by parent or arm ID to the same complete organisation", () => {
    const orgs = buildRollup([arm("a"), arm("b", "provider")], [user("u", "a")], [], [], now);
    expect(resolveAggregator(orgs, "parent")).toEqual(resolveAggregator(orgs, "b"));
    expect(resolveAggregator(orgs, "b")[0].coordinators).toHaveLength(2);
    expect(resolveAggregator(orgs, "missing")).toEqual([]);
  });
  for (const name of ["test_marker", "Demo test", "Temp - SP", "Aryan Test"]) {
    it(`excludes ${name} and its users rather than falling back to arm IDs`, () => {
      expect(buildRollup([arm("a", "seeker", "parent", name)], [user("u", "a")], [], [], now)).toEqual([]);
    });
  }
  it("excludes all arms of a flagged test parent", () => {
    expect(buildRollup([{ ...arm("a"), test_flag: true }, arm("b")], [user("u", "b")], [], [], now)).toEqual([]);
  });
  it("keeps unmatched real users under their arm ID with Unit label", () => {
    const o = buildRollup([], [user("u", "unknown")], [], [], now)[0];
    expect(o.name).toBe("unknown"); expect(o.coordinators[0].typeLabel).toBe("Unit");
  });
  it("preserves 7/30/90-day seeker lifecycle and identical parent/arm totals", () => {
    const users = [user("new", "a", "seeker", 7), user("active", "a"), user("risk", "a"), user("inactive", "a")];
    const actions = [30, 90, 91].map((age, i) => ({ action_id: String(i), source_item_owner: users[i + 1].id, created_at: daysAgo(age) }));
    const o = buildRollup([arm("a")], users, actions, [], now)[0];
    expect(o.seekers).toEqual({ dots: 4, new7d: 1, active: 1, atRisk: 1, inactive: 1, applied: 3 });
    expect(o.coordinators[0].seekers).toEqual(o.seekers);
  });
  it("counts live provider postings at both levels", () => {
    const o = buildRollup([arm("b", "provider")], [user("p", "b", "provider")], [], [{ item_id: "job", created_by: "p" }], now)[0];
    expect(o.providers.active).toBe(1); expect(o.livePostings).toBe(1); expect(o.coordinators[0].livePostings).toBe(1);
  });
  it("caps real members at 150 per kind at parent and arm level without capping counts", () => {
    const o = buildRollup([arm("a")], Array.from({ length: 160 }, (_, i) => user(String(i), "a")), [], [], now)[0];
    expect(o.seekers.dots).toBe(160); expect(o.members).toHaveLength(150); expect(o.coordinators[0].members).toHaveLength(150);
  });
});