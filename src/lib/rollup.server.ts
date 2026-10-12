import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Canonical Blue Dots tables live in the campaign-manager project (NEW_SUPABASE_*), public schema.
// Org = bluedot_users.onboarded_by_org_id. Server-only.
function cmClient(): SupabaseClient<any, any, any> | null {
  const url = process.env.NEW_SUPABASE_URL;
  const key = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Lifecycle = "New" | "Active" | "At Risk" | "Inactive";
export interface RollupMember { id: string; kind: "seeker" | "provider"; joined: string; applications: number; livePostings: number; lifecycle: Lifecycle }
export interface RollupStats { dots: number; new7d: number; active: number; atRisk: number; inactive: number; applied: number }
export interface RollupOrg { id: string; name: string; seekers: RollupStats; providers: RollupStats; livePostings: number; members: RollupMember[] }
export type DistrictRollup =
  | { available: true; instance: string; orgs: RollupOrg[]; coordinatorTier: "sample" }
  | { available: false };

const PAGE = 1000;
const MEMBERS_PER_KIND = 150;
const emptyStats = (): RollupStats => ({ dots: 0, new7d: 0, active: 0, atRisk: 0, inactive: 0, applied: 0 });

// Keyset pagination on a unique key; continue from the last key actually returned.
async function readAll<T extends Record<string, unknown>>(
  sb: SupabaseClient<any, any, any>, table: string, cols: string, key: string, instance: string,
  extra?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  let last: string | null = null;
  for (let guard = 0; guard < 500; guard++) {
    let q = sb.from(table).select(cols).eq("instance", instance).order(key, { ascending: true }).limit(PAGE);
    if (extra) q = extra(q);
    if (last !== null) q = q.gt(key, last);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length === 0) break;
    last = String(rows[rows.length - 1][key]);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function loadDistrictRollup(instance: string, aggregatorId?: string | null): Promise<DistrictRollup> {
  try {
    const sb = cmClient();
    if (!sb || !instance) return { available: false };
    const [users, applies, postings] = await Promise.all([
      readAll<{ id: string; created_at: string; domains: string[] | null; onboarded_by_org_id: string | null }>(
        sb, "bluedot_users", "id,created_at,domains,onboarded_by_org_id", "id", instance,
        aggregatorId ? (q) => q.eq("onboarded_by_org_id", aggregatorId) : undefined),
      readAll<{ action_id: string; source_item_owner: string; created_at: string }>(
        sb, "bluedot_item_actions", "action_id,source_item_owner,created_at", "action_id", instance, (q) => q.eq("action_type", "apply")),
      readAll<{ item_id: string; created_by: string }>(
        sb, "bluedot_items", "item_id,created_by", "item_id", instance, (q) => q.eq("item_type", "job_posting_1.0").eq("lifecycle_status", "live")),
    ]);
    if (!users.length) return { available: false };

    const lastApply = new Map<string, number>();
    const applyCount = new Map<string, number>();
    for (const a of applies) {
      const t = Date.parse(a.created_at);
      applyCount.set(a.source_item_owner, (applyCount.get(a.source_item_owner) ?? 0) + 1);
      if (Number.isFinite(t) && t > (lastApply.get(a.source_item_owner) ?? 0)) lastApply.set(a.source_item_owner, t);
    }
    const liveBy = new Map<string, number>();
    for (const p of postings) liveBy.set(p.created_by, (liveBy.get(p.created_by) ?? 0) + 1);

    const now = Date.now();
    const DAY = 86400000;
    const orgs = new Map<string, RollupOrg & { sCount: number; pCount: number }>();
    for (const u of users) {
      const doms = u.domains ?? [];
      const isSeeker = doms.includes("seeker");
      const isProvider = doms.includes("provider");
      if (!isSeeker && !isProvider) continue;
      const orgId = u.onboarded_by_org_id || "unattributed";
      let o = orgs.get(orgId);
      if (!o) { o = { id: orgId, name: orgId, seekers: emptyStats(), providers: emptyStats(), livePostings: 0, members: [], sCount: 0, pCount: 0 }; orgs.set(orgId, o); }
      const created = Date.parse(u.created_at);
      const isNew = Number.isFinite(created) && now - created <= 7 * DAY;

      if (isSeeker) {
        const la = lastApply.get(u.id);
        const apps = applyCount.get(u.id) ?? 0;
        const lc: Lifecycle = isNew ? "New" : la && now - la <= 30 * DAY ? "Active" : la && now - la <= 90 * DAY ? "At Risk" : "Inactive";
        const s = o.seekers;
        s.dots++; if (apps > 0) s.applied++;
        if (lc === "New") s.new7d++; else if (lc === "Active") s.active++; else if (lc === "At Risk") s.atRisk++; else s.inactive++;
        if (o.sCount++ < MEMBERS_PER_KIND) o.members.push({ id: u.id, kind: "seeker", joined: u.created_at, applications: apps, livePostings: 0, lifecycle: lc });
      }
      if (isProvider) {
        const live = liveBy.get(u.id) ?? 0;
        const lc: Lifecycle = isNew ? "New" : live > 0 ? "Active" : "Inactive";
        const p = o.providers;
        p.dots++; if (live > 0) p.applied++;
        if (lc === "New") p.new7d++; else if (lc === "Active") p.active++; else p.inactive++;
        o.livePostings += live;
        if (o.pCount++ < MEMBERS_PER_KIND) o.members.push({ id: u.id, kind: "provider", joined: u.created_at, applications: 0, livePostings: live, lifecycle: lc });
      }
    }
    const list = [...orgs.values()].map(({ sCount: _s, pCount: _p, ...o }) => o)
      .sort((a, b) => b.seekers.dots + b.providers.dots - (a.seekers.dots + a.providers.dots));
    return { available: true, instance, orgs: list, coordinatorTier: "sample" };
  } catch (e) {
    console.error("[rollup] district rollup failed", e);
    return { available: false };
  }
}
