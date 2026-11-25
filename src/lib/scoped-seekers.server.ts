import { blueDotsClient } from "./blue-dots-auth.server";
import { mapLiveProfile, type ApplyStats, type LiveProfile, type Seeker } from "./my-blue-dots-live.model";

export type ScopedSeekerRow = {
  id: string; userId: string; joined: string; profileSignal: Seeker["profileSignal"]; profileCompletion: number;
  status: Seeker["status"]; applied: number; accepted: number; rejected: number; pending: number; servicesAccepted: number;
};
export type ScopedSeekers = { rows: ScopedSeekerRow[]; capped: boolean };
const CAP = 1000;
const PAGE = 500;
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function loadScopedSeekers(instance: string, coordinatorId: string): Promise<ScopedSeekers> {
  const db = blueDotsClient();
  const userIds: string[] = [];
  for (let last = ""; ;) {
    let q = db.from("bluedot_users").select("id").eq("onboarded_by_org_id", coordinatorId).order("id").limit(PAGE);
    if (last) q = q.gt("id", last);
    const { data, error } = await q;
    if (error) throw new Error("Couldn't load seekers");
    const rows = (data ?? []) as { id: string }[];
    userIds.push(...rows.map(r => r.id));
    if (!rows.length || userIds.length > 20000) break;
    last = rows[rows.length - 1]!.id;
  }
  const profiles: LiveProfile[] = [];
  for (const ids of chunks(userIds, 150)) {
    for (let last = ""; profiles.length <= CAP;) {
      let q = db.from("bluedot_seeker_profiles").select("item_id,created_by,created_at,instance,role_wanted_raw,age_masked,education_category,work_experience,is_default_geo")
        .eq("instance", instance).in("created_by", ids).order("item_id").limit(PAGE);
      if (last) q = q.gt("item_id", last);
      const { data, error } = await q;
      if (error) throw new Error("Couldn't load seekers");
      const rows = (data ?? []) as LiveProfile[];
      profiles.push(...rows);
      if (!rows.length) break;
      last = rows[rows.length - 1]!.item_id;
    }
    if (profiles.length > CAP) break;
  }
  const capped = profiles.length > CAP;
  profiles.sort((a, b) => a.item_id.localeCompare(b.item_id));
  const kept = profiles.slice(0, CAP);
  const owners = [...new Set(kept.map(p => p.created_by).filter((x): x is string => !!x))];
  const stats = new Map<string, ApplyStats & { services: number }>();
  for (const ids of chunks(owners, 150)) {
    for (let last = ""; ;) {
      let q = db.from("bluedot_item_actions").select("action_id,source_item_owner,action_status,target_item_domain,created_at")
        .eq("action_type", "apply").eq("instance", instance).in("source_item_owner", ids).order("action_id").limit(PAGE);
      if (last) q = q.gt("action_id", last);
      const { data, error } = await q;
      if (error) throw new Error("Couldn't load seekers");
      const rows = (data ?? []) as { action_id: string; source_item_owner: string; action_status: string | null; target_item_domain: string | null; created_at: string | null }[];
      for (const a of rows) {
        const s = stats.get(a.source_item_owner) ?? { total: 0, accepted: 0, rejected: 0, pending: 0, cancelled: 0, latest: null, services: 0 };
        s.total++;
        if (a.action_status === "accepted") { s.accepted++; if (a.target_item_domain === "service_provider") s.services++; }
        else if (a.action_status === "rejected") s.rejected++;
        else if (a.action_status === "created") s.pending++;
        else if (a.action_status === "cancelled") s.cancelled++;
        if (a.created_at && (!s.latest || Date.parse(a.created_at) > Date.parse(s.latest))) s.latest = a.created_at;
        stats.set(a.source_item_owner, s);
      }
      if (rows.length < 1) break;
      last = rows[rows.length - 1]!.action_id;
    }
  }
  const now = Date.now();
  const rows = kept.map(p => {
    const s = p.created_by ? stats.get(p.created_by) : undefined;
    const apps = new Map<string, ApplyStats>(s ? [[`${p.instance}:${p.item_id}`, s]] : []);
    const m = mapLiveProfile(p, apps, now);
    return { id: m.id, userId: m.userId, joined: m.createdOn, profileSignal: m.profileSignal, profileCompletion: m.profileCompletion, status: m.status,
      applied: s?.total ?? 0, accepted: s?.accepted ?? 0, rejected: s?.rejected ?? 0, pending: s?.pending ?? 0, servicesAccepted: s?.services ?? 0 };
  });
  return { rows, capped };
}
