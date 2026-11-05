import { emptyStats, statsFor, type ParticipantView, type RollupOrg, type RollupCoordinator, type RollupMember, type RollupStats } from "./rollup.model";

export type { ParticipantView } from "./rollup.model";
export interface LiveNode extends RollupStats { id: string; name: string; activity: number; quiet: boolean; members: RollupMember[] }
export function nodeFor(o: RollupOrg | RollupCoordinator, view: ParticipantView): LiveNode {
  const s = statsFor(o, view);
  const activity = s.dots ? Math.max(6, Math.min(100, Math.round((s.active / s.dots / 0.15) * 55 + (s.new7d / s.dots / 0.045) * 35 + 6))) : 0;
  return { ...s, id: o.id, name: o.name, activity, quiet: s.dots > 0 && s.new7d === 0, members: o.members.filter(m => view === "all" || m.kind === view) };
}
export function totalsFor(nodes: RollupStats[]): RollupStats {
  return nodes.reduce((sum, node) => ({ dots: sum.dots + node.dots, new7d: sum.new7d + node.new7d, active: sum.active + node.active, atRisk: sum.atRisk + node.atRisk, inactive: sum.inactive + node.inactive, applied: sum.applied + node.applied }), emptyStats());
}
/** Coverage counts only units with participants in the selected view; tables retain zero-dot arms. */
export function coverageFor(nodes: RollupStats[]) {
  const count = nodes.filter(n => n.dots > 0).length;
  return { count, average: count ? Math.round(totalsFor(nodes).dots / count) : 0 };
}