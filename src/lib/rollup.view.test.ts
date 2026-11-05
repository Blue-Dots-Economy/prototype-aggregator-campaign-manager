import { describe, expect, it } from "vitest";
import { buildRollup, statsFor, type ParticipantView } from "./rollup.model";
import { coverageFor, nodeFor, totalsFor } from "./rollup.view";

const now = Date.parse("2026-11-05T02:13:00Z");
const ago = (days: number) => new Date(now - days * 86400000).toISOString();
const arms = ["seeker", "provider", "service_provider"].map(type => ({ org_id: "jfc", org_name: "JFC", coordinator_org_id: type, coordinator_org_name: "JFC", coordinator_type: type, test_flag: false }));
const users = [
  ...Array.from({ length: 1381 }, (_, i) => ({ id: `s${i}`, domains: ["seeker"], created_at: ago(i === 0 ? 1 : 100), onboarded_by_org_id: "seeker" })),
  ...Array.from({ length: 27 }, (_, i) => ({ id: `p${i}`, domains: ["provider"], created_at: ago(i === 0 ? 1 : 100), onboarded_by_org_id: "provider" })),
];
const org = buildRollup(arms, users, [{ action_id: "active", source_item_owner: "s1", created_at: ago(10) }, { action_id: "risk", source_item_owner: "s2", created_at: ago(40) }], [{ item_id: "job", created_by: "p1" }], now)[0];
describe("My Blue Dots participant selection", () => {
  const cases: { view: ParticipantView; expected: number; lifecycle: number[]; counts: number[]; coverage: number; average: number; applied: number }[] = [
    { view: "all", expected: 1408, lifecycle: [2, 2, 1, 1403], counts: [1381, 27, 0], coverage: 2, average: 704, applied: 3 },
    { view: "seeker", expected: 1381, lifecycle: [1, 1, 1, 1378], counts: [1381, 0, 0], coverage: 1, average: 1381, applied: 2 },
    { view: "provider", expected: 27, lifecycle: [1, 1, 0, 25], counts: [0, 27, 0], coverage: 1, average: 27, applied: 1 },
  ];
  for (const c of cases) {
    it(`${c.view} selects exact totals and every lifecycle count for parent and arms`, () => {
      const node = nodeFor(org, c.view);
      const coords = org.coordinators.map(a => nodeFor(a, c.view));
      expect(statsFor(org, c.view).dots).toBe(c.expected);
      expect(node.dots).toBe(c.expected);
      expect([node.new7d, node.active, node.atRisk, node.inactive]).toEqual(c.lifecycle);
      expect(coords.map(a => a.dots)).toEqual(c.counts);
      expect(totalsFor(coords)).toEqual(statsFor(org, c.view));
      expect(node.applied).toBe(c.applied);
      expect(node.members.every(m => c.view === "all" || m.kind === c.view)).toBe(true);
    });
    it(`${c.view} uses viewed units for coverage without dropping zero-dot rows`, () => {
      const coords = org.coordinators.map(a => nodeFor(a, c.view));
      expect(coords).toHaveLength(3);
      expect(coverageFor(coords)).toEqual({ count: c.coverage, average: c.average });
      expect(coords.filter(a => a.dots === 0).every(a => a.activity === 0 && !a.quiet)).toBe(true);
      const sorted = [...coords].sort((a, b) => b.dots - a.dots);
      expect(sorted[0].dots).toBe(c.view === "provider" ? 27 : 1381);
    });
  }
  it("recomputes activity from the selected active and onboarding shares", () => {
    expect(nodeFor(org, "all").activity).toBe(8);
    expect(nodeFor(org, "seeker").activity).toBe(7);
    expect(nodeFor(org, "provider").activity).toBe(48);
  });
  it("returns zero coverage and average for a view with no participants", () => {
    expect(coverageFor([nodeFor(org.coordinators[2], "provider")])).toEqual({ count: 0, average: 0 });
  });
});