import { blueDotsClient } from "./blue-dots-auth.server";
import { rollupFromCounts, resolveAggregator, type ArmCounts, type DistrictRollup, type RollupMember } from "./rollup.model";
export type { DistrictRollup, RollupOrg, RollupCoordinator, RollupMember, RollupStats, Lifecycle } from "./rollup.model";

export async function loadDistrictRollup(instance: string, aggregatorId?: string | null, offset = 0, coordinatorId?: string | null): Promise<DistrictRollup> {
  try {
    const { data, error } = await blueDotsClient().rpc("get_bluedot_rollup", { p_instance: instance });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ArmCounts[];
    const updatedAt = rows[0]?.updated_at ?? null;
    if (!updatedAt) return { available: false };
    const all = rollupFromCounts(rows);
    if (coordinatorId) {
      const org = all.find(o => o.coordinators.some(c => c.id === coordinatorId));
      const coord = org?.coordinators.find(c => c.id === coordinatorId);
      return { available: true, instance, updatedAt, orgs: org && coord ? [{ ...org, seekers: coord.seekers, providers: coord.providers, livePostings: coord.livePostings, members: [], coordinators: [coord] }] : [], nextOffset: null };
    }
    const scoped = aggregatorId ? resolveAggregator(all, aggregatorId) : all;
    // Bound every server response, including all registered arms of one organisation.
    const orgs = scoped.slice(offset, offset + 100);
    return { available: true, instance, updatedAt, orgs, nextOffset: offset + orgs.length < scoped.length ? offset + orgs.length : null };
  } catch (e) {
    console.error("[rollup] district rollup failed", e);
    return { available: false };
  }
}

export async function loadArmMembers(input: { instance: string; aggregatorId?: string | null; coordinatorId?: string | null; kind: string }): Promise<RollupMember[]> {
  const { data, error } = await blueDotsClient().rpc("get_bluedot_members", { p_instance: input.instance, p_org_id: input.aggregatorId ?? null, p_coordinator_id: input.coordinatorId ?? null, p_kind: input.kind });
  if (error) throw new Error("Couldn't load participants");
  return (data ?? []).map((m: { id: string; joined: string; kind: "seeker" | "provider"; applications: number; live_postings: number; lifecycle: RollupMember["lifecycle"] }) => ({ id: m.id, joined: m.joined, kind: m.kind, applications: Number(m.applications), livePostings: Number(m.live_postings), lifecycle: m.lifecycle }));
}
