export const PROFILE_FIELD_LABELS = ["Role", "Age", "Education", "Experience", "Location"] as const;
export type ProfileFieldCheck = { label: string; passed: boolean; value: string };
export type Seeker = {
  id: string; userId: string; instance: string; name: string; location: string; role: string;
  createdOn: string; profileAge: number | null; lastAppliedAge: number | null;
  applications: number; accepted: number; rejected: number; pending: number; cancelled: number;
  profileCompletion: number; profileFieldChecks: ProfileFieldCheck[]; phone: string;
  status: "New" | "Active" | "At Risk" | "Inactive";
  profileStatus: "Complete" | "Incomplete"; profileSignal: "Strong" | "Moderate" | "Weak";
  recommendedAction: string;
};
export type LiveProfile = {
  item_id: string; created_by: string | null; created_at: string | null; instance: string;
  role_wanted_raw: string | null; age_masked: string | null;
  education_category: string | null; work_experience: string | null; is_default_geo: boolean | null;
};
export type ApplyAction = {
  action_id: string; source_item_id: string | null; action_status: string | null;
  created_at: string | null; instance: string;
};
export type ApplyStats = { total: number; accepted: number; rejected: number; pending: number; cancelled: number; latest: string | null };
export function aggregateActions(actions: ApplyAction[]): Map<string, ApplyStats> {
  const out = new Map<string, ApplyStats>();
  for (const a of actions) {
    if (!a.source_item_id) continue;
    const key = `${a.instance}:${a.source_item_id}`;
    const s = out.get(key) ?? { total: 0, accepted: 0, rejected: 0, pending: 0, cancelled: 0, latest: null };
    s.total++;
    if (a.action_status === "accepted") s.accepted++;
    else if (a.action_status === "rejected") s.rejected++;
    else if (a.action_status === "created") s.pending++;
    else if (a.action_status === "cancelled") s.cancelled++;
    if (a.created_at && Number.isFinite(Date.parse(a.created_at)) && (!s.latest || Date.parse(a.created_at) > Date.parse(s.latest))) s.latest = a.created_at;
    out.set(key, s);
  }
  return out;
}
export function daysSince(date: string | null, now: number): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
}
export function computeStatus(profileAge: number | null, lastAppliedAge: number | null): Seeker["status"] {
  if ((profileAge ?? 9999) <= 7) return "New";
  if (lastAppliedAge !== null && lastAppliedAge <= 30) return "Active";
  if (lastAppliedAge !== null && lastAppliedAge >= 31 && lastAppliedAge <= 90) return "At Risk";
  return "Inactive";
}
export function computeAction(status: Seeker["status"], profileStatus: Seeker["profileStatus"], lastAppliedAge: number | null): string {
  if (profileStatus === "Incomplete") return "Complete Profile";
  if (status === "New" || status === "At Risk") return "Automated Call";
  if (status === "Inactive") return "Manual Call";
  return lastAppliedAge !== null && lastAppliedAge > 14 ? "Automated Call" : "No Action";
}
export function mapLiveProfile(r: LiveProfile, apps: Map<string, ApplyStats>, now: number): Seeker {
  const role = (r.role_wanted_raw ?? "").trim();
  const age = (r.age_masked ?? "").trim();
  const education = (r.education_category ?? "").trim();
  const experience = (r.work_experience ?? "").trim();
  const location = r.is_default_geo === false;
  const fields: ProfileFieldCheck[] = [
    { label: "Role", passed: Boolean(role) && role.toLowerCase() !== "any", value: role },
    { label: "Age", passed: Boolean(age), value: age },
    { label: "Education", passed: Boolean(education), value: education },
    { label: "Experience", passed: Boolean(experience), value: experience },
    { label: "Location", passed: location, value: location ? "Location set" : "" },
  ];
  const passed = fields.filter(f => f.passed).length;
  const profileStatus = passed === 5 ? "Complete" : "Incomplete";
  const core = fields.filter(f => ["Role", "Age", "Location"].includes(f.label)).every(f => f.passed);
  const a = apps.get(`${r.instance}:${r.item_id}`);
  const profileAge = daysSince(r.created_at, now);
  const lastAppliedAge = daysSince(a?.latest ?? null, now);
  const status = computeStatus(profileAge, lastAppliedAge);
  return {
    id: r.item_id, userId: r.created_by ?? "", instance: r.instance,
    name: "", phone: "", location: location ? "Location set" : "", role,
    createdOn: r.created_at ?? "", profileAge, lastAppliedAge,
    applications: a?.total ?? 0, accepted: a?.accepted ?? 0, rejected: a?.rejected ?? 0,
    pending: a?.pending ?? 0, cancelled: a?.cancelled ?? 0,
    profileCompletion: passed * 20, profileFieldChecks: fields, profileStatus,
    profileSignal: profileStatus === "Complete" ? "Strong" : core ? "Moderate" : "Weak",
    status, recommendedAction: computeAction(status, profileStatus, lastAppliedAge),
  };
}
export function summarizeSeekers(seekers: Seeker[]) {
  const users = new Map<string, number>();
  const usersWithApps = new Set<string>();
  const lifecycle = { New: 0, Active: 0, "At Risk": 0, Inactive: 0 };
  const signalByStatus = {
    New: { Strong: 0, Moderate: 0, Weak: 0 }, Active: { Strong: 0, Moderate: 0, Weak: 0 },
    "At Risk": { Strong: 0, Moderate: 0, Weak: 0 }, Inactive: { Strong: 0, Moderate: 0, Weak: 0 },
  };
  let applications = 0, complete = 0;
  for (const s of seekers) {
    lifecycle[s.status]++; signalByStatus[s.status][s.profileSignal]++;
    applications += s.applications;
    if (s.profileStatus === "Complete") complete++;
    if (s.userId) {
      users.set(s.userId, (users.get(s.userId) ?? 0) + 1);
      if (s.applications) usersWithApps.add(s.userId);
    }
  }
  return { profiles: seekers.length, complete, applications, users: users.size,
    usersMulti: [...users.values()].filter(n => n > 1).length, usersWithApps: usersWithApps.size,
    lifecycle, signalByStatus };
}