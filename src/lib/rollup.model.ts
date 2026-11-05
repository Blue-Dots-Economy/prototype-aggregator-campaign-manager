export type Lifecycle = "New" | "Active" | "At Risk" | "Inactive";
export interface RollupMember { id: string; kind: "seeker" | "provider"; joined: string; applications: number; livePostings: number; lifecycle: Lifecycle }
export interface RollupStats { dots: number; new7d: number; active: number; atRisk: number; inactive: number; applied: number }
export interface RollupCoordinator { id: string; name: string; type: string; typeLabel: string; seekers: RollupStats; providers: RollupStats; livePostings: number; members: RollupMember[] }
export interface RollupOrg { id: string; name: string; seekers: RollupStats; providers: RollupStats; livePostings: number; members: RollupMember[]; coordinators: RollupCoordinator[] }
export type DistrictRollup = { available: true; instance: string; orgs: RollupOrg[]; nextOffset: number | null; updatedAt?: string | null } | { available: false };
export interface AggregatorRow { org_id: string; org_name: string | null; coordinator_org_id: string; coordinator_org_name: string | null; coordinator_type: string | null; test_flag: boolean | null }
export interface UserRow { id: string; created_at: string; domains: string[] | null; onboarded_by_org_id: string | null }
export interface ApplyRow { action_id: string; source_item_owner: string; created_at: string }
export interface PostingRow { item_id: string; created_by: string }
export const emptyStats = (): RollupStats => ({ dots: 0, new7d: 0, active: 0, atRisk: 0, inactive: 0, applied: 0 });
export type ParticipantView = "all" | "seeker" | "provider";
/** The single stats selector for every participant-view surface. */
export function statsFor(o: Pick<RollupOrg, "seekers" | "providers">, view: ParticipantView): RollupStats {
  if (view === "seeker") return o.seekers;
  if (view === "provider") return o.providers;
  const a = o.seekers, b = o.providers;
  return { dots: a.dots + b.dots, new7d: a.new7d + b.new7d, active: a.active + b.active, atRisk: a.atRisk + b.atRisk, inactive: a.inactive + b.inactive, applied: a.applied + b.applied };
}
const MEMBERS_PER_KIND = 150;
const DAY = 86400000;
const labels: Record<string, string> = { seeker: "Seeker unit", provider: "Provider unit", service_provider: "Service-provider unit" };
export const typeLabelFor = (type?: string | null) => type ? labels[type] ?? type : "Unit";

export function buildRollup(arms: AggregatorRow[], users: UserRow[], applies: ApplyRow[], postings: PostingRow[], now = Date.now()): RollupOrg[] {
  const excludedParents = new Set(arms.filter(a => a.test_flag === true || /test_marker|test\b|temp\s*-\s*sp|aryan test/i.test(a.org_name ?? "")).map(a => a.org_id));
  const excludedArms = new Set(arms.filter(a => excludedParents.has(a.org_id)).map(a => a.coordinator_org_id));
  const coordInfo = new Map<string, { orgId: string; orgName: string; coordName: string | undefined; type: string }>();
  for (const a of arms) {
    if (!a.coordinator_org_id || !a.org_id || excludedParents.has(a.org_id)) continue;
    coordInfo.set(a.coordinator_org_id, { orgId: a.org_id, orgName: a.org_name?.trim() || a.org_id, coordName: a.coordinator_org_name?.trim(), type: a.coordinator_type ?? "" });
  }
  const orgs = new Map<string, RollupOrg>();
  const coords = new Map<string, RollupCoordinator>();
  function ensure(coordId: string) {
    const info = coordInfo.get(coordId);
    const orgId = info?.orgId ?? coordId;
    let org = orgs.get(orgId);
    if (!org) {
      org = { id: orgId, name: info?.orgName ?? coordId, seekers: emptyStats(), providers: emptyStats(), livePostings: 0, members: [], coordinators: [] };
      orgs.set(orgId, org);
    }
    let coord = coords.get(coordId);
    if (!coord) {
      coord = { id: coordId, name: info?.coordName || typeLabelFor(info?.type), type: info?.type ?? "", typeLabel: typeLabelFor(info?.type), seekers: emptyStats(), providers: emptyStats(), livePostings: 0, members: [] };
      coords.set(coordId, coord);
      org.coordinators.push(coord);
    }
    return { org, coord };
  }
  // Registered arms remain real even when they currently have no participants.
  for (const id of coordInfo.keys()) ensure(id);
  const applyCount = new Map<string, number>();
  const lastApply = new Map<string, number>();
  for (const a of applies) {
    applyCount.set(a.source_item_owner, (applyCount.get(a.source_item_owner) ?? 0) + 1);
    const t = Date.parse(a.created_at);
    if (Number.isFinite(t) && t > (lastApply.get(a.source_item_owner) ?? 0)) lastApply.set(a.source_item_owner, t);
  }
  const liveBy = new Map<string, number>();
  for (const p of postings) liveBy.set(p.created_by, (liveBy.get(p.created_by) ?? 0) + 1);
  function accumulate(target: RollupOrg | RollupCoordinator, member: RollupMember) {
    const s = member.kind === "seeker" ? target.seekers : target.providers;
    s.dots++;
    if (member.applications > 0 || member.livePostings > 0) s.applied++;
    const key = { New: "new7d", Active: "active", "At Risk": "atRisk", Inactive: "inactive" } as const;
    s[key[member.lifecycle]]++;
    target.livePostings += member.livePostings;
    if (s.dots <= MEMBERS_PER_KIND) target.members.push(member);
  }
  for (const u of users) {
    const coordId = u.onboarded_by_org_id || "unattributed";
    if (excludedArms.has(coordId)) continue;
    const domains = u.domains ?? [];
    if (!domains.includes("seeker") && !domains.includes("provider")) continue;
    const { org, coord } = ensure(coordId);
    const created = Date.parse(u.created_at);
    const isNew = Number.isFinite(created) && now - created <= 7 * DAY;
    for (const kind of ["seeker", "provider"] as const) {
      if (!domains.includes(kind)) continue;
      const apps = kind === "seeker" ? applyCount.get(u.id) ?? 0 : 0;
      const live = kind === "provider" ? liveBy.get(u.id) ?? 0 : 0;
      const last = lastApply.get(u.id);
      const lifecycle: Lifecycle = isNew ? "New" : kind === "provider" ? live > 0 ? "Active" : "Inactive" : last && now - last <= 30 * DAY ? "Active" : last && now - last <= 90 * DAY ? "At Risk" : "Inactive";
      const member: RollupMember = { id: u.id, kind, joined: u.created_at, applications: apps, livePostings: live, lifecycle };
      accumulate(org, member);
      accumulate(coord, member);
    }
  }
  const dots = (o: RollupOrg | RollupCoordinator) => o.seekers.dots + o.providers.dots;
  for (const o of orgs.values()) {
    const nameCounts = new Map<string, number>();
    for (const coord of o.coordinators) nameCounts.set(coord.name, (nameCounts.get(coord.name) ?? 0) + 1);
    for (const coord of o.coordinators) {
      if ((nameCounts.get(coord.name) ?? 0) >= 2) coord.name = `${coord.name} (${coord.type})`;
    }
    o.coordinators.sort((a, b) => dots(b) - dots(a));
  }
  return [...orgs.values()].sort((a, b) => dots(b) - dots(a));
}

export function resolveAggregator(orgs: RollupOrg[], id: string): RollupOrg[] {
  const org = orgs.find(o => o.id === id || o.coordinators.some(c => c.id === id));
  return org ? [org] : [];
}

export interface ArmCounts extends Omit<AggregatorRow, "test_flag"> {
  s_total: number; s_new: number; s_active: number; s_at_risk: number; s_inactive: number; s_applied: number;
  p_total: number; p_new: number; p_active: number; p_inactive: number; p_live_postings: number; p_applied?: number;
  updated_at?: string | null;
}
/** Count-only SQL projection; no participant rows travel with the initial view. */
export function rollupFromCounts(rows: ArmCounts[]): RollupOrg[] {
  const orgs = new Map<string, RollupOrg>();
  for (const r of rows) {
    let org = orgs.get(r.org_id);
    if (!org) {
      org = { id: r.org_id, name: r.org_name?.trim() || r.org_id, seekers: emptyStats(), providers: emptyStats(), livePostings: 0, members: [], coordinators: [] };
      orgs.set(r.org_id, org);
    }
    const seekers = { dots: Number(r.s_total), new7d: Number(r.s_new), active: Number(r.s_active), atRisk: Number(r.s_at_risk), inactive: Number(r.s_inactive), applied: Number(r.s_applied) };
    const providers = { dots: Number(r.p_total), new7d: Number(r.p_new), active: Number(r.p_active), atRisk: 0, inactive: Number(r.p_inactive), applied: 0 };
    // Provider applied counts participants with live postings, including New participants.
    providers.applied = Number(r.p_applied ?? r.p_active);
    const type = r.coordinator_type ?? "";
    org.coordinators.push({ id: r.coordinator_org_id, name: r.coordinator_org_name?.trim() || typeLabelFor(type), type, typeLabel: typeLabelFor(type), seekers, providers, livePostings: Number(r.p_live_postings), members: [] });
    for (const key of Object.keys(seekers) as (keyof RollupStats)[]) { org.seekers[key] += seekers[key]; org.providers[key] += providers[key]; }
    org.livePostings += Number(r.p_live_postings);
  }
  const dots = (o: RollupOrg | RollupCoordinator) => o.seekers.dots + o.providers.dots;
  for (const o of orgs.values()) {
    const names = new Map<string, number>();
    for (const c of o.coordinators) names.set(c.name, (names.get(c.name) ?? 0) + 1);
    for (const c of o.coordinators) if ((names.get(c.name) ?? 0) > 1) c.name += ` (${c.type})`;
    o.coordinators.sort((a, b) => dots(b) - dots(a));
  }
  return [...orgs.values()].sort((a, b) => dots(b) - dots(a));
}