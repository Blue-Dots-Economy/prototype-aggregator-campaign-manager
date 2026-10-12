import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Ecosystem (Blue Dots) project, `bluedot` schema. Server-only.
function ecoClient(): SupabaseClient | null {
  const url = process.env.ECO_SUPABASE_URL;
  const key = process.env.ECO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: "bluedot" }, auth: { persistSession: false, autoRefreshToken: false } });
}

export type Lifecycle = "New" | "Active" | "At Risk" | "Inactive";
export interface RollupSeeker { id: string; joined: string; applications: number; lifecycle: Lifecycle }
export interface RollupOrg { id: string; name: string; dots: number; new7d: number; active: number; atRisk: number; inactive: number; applied: number; seekers: RollupSeeker[] }
export type DistrictRollup =
  | { available: true; instance: string; total: number; orgs: RollupOrg[]; coordinatorTier: "sample" }
  | { available: false };

const PAGE = 1000;
const SEEKERS_PER_ORG = 200;

// Keyset pagination: order by a unique key, continue from the last key actually returned.
async function readAll<T extends Record<string, unknown>>(
  sb: SupabaseClient, table: string, cols: string, key: string, instance: string,
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

export async function loadDistrictRollup(instance: string): Promise<DistrictRollup> {
  try {
    const sb = ecoClient();
    if (!sb || !instance) return { available: false };
    const [seekers, users, applies] = await Promise.all([
      readAll<{ item_id: string; created_by: string; created_at: string }>(sb, "seeker_profiles", "item_id,created_by,created_at", "item_id", instance),
      readAll<{ id: string; onboarded_by_org_id: string | null }>(sb, "users", "id,onboarded_by_org_id", "id", instance),
      readAll<{ action_id: string; source_item_id: string; created_at: string }>(sb, "item_actions", "action_id,source_item_id,created_at", "action_id", instance, (q) => q.eq("action_type", "apply")),
    ]);
    if (!seekers.length) return { available: false };

    const orgOf = new Map(users.map((u) => [u.id, u.onboarded_by_org_id]));
    const lastApply = new Map<string, number>();
    const applyCount = new Map<string, number>();
    for (const a of applies) {
      const t = Date.parse(a.created_at);
      applyCount.set(a.source_item_id, (applyCount.get(a.source_item_id) ?? 0) + 1);
      if (Number.isFinite(t) && t > (lastApply.get(a.source_item_id) ?? 0)) lastApply.set(a.source_item_id, t);
    }

    const now = Date.now();
    const DAY = 86400000;
    const orgs = new Map<string, RollupOrg>();
    for (const s of seekers) {
      const orgId = orgOf.get(s.created_by) || "unattributed";
      let o = orgs.get(orgId);
      if (!o) { o = { id: orgId, name: orgId, dots: 0, new7d: 0, active: 0, atRisk: 0, inactive: 0, applied: 0, seekers: [] }; orgs.set(orgId, o); }
      const created = Date.parse(s.created_at);
      const la = lastApply.get(s.item_id);
      const apps = applyCount.get(s.item_id) ?? 0;
      let lc: Lifecycle = "Inactive";
      if (Number.isFinite(created) && now - created <= 7 * DAY) lc = "New";
      else if (la && now - la <= 30 * DAY) lc = "Active";
      else if (la && now - la <= 90 * DAY) lc = "At Risk";
      o.dots++;
      if (apps > 0) o.applied++;
      if (lc === "New") o.new7d++; else if (lc === "Active") o.active++; else if (lc === "At Risk") o.atRisk++; else o.inactive++;
      if (o.seekers.length < SEEKERS_PER_ORG) o.seekers.push({ id: s.item_id, joined: s.created_at, applications: apps, lifecycle: lc });
    }
    return { available: true, instance, total: seekers.length, orgs: [...orgs.values()].sort((a, b) => b.dots - a.dots), coordinatorTier: "sample" };
  } catch (e) {
    console.error("[rollup] district rollup failed", e);
    return { available: false };
  }
}
