import { blueDotsClient } from "./blue-dots-auth.server";
import { type Seeker } from "./my-blue-dots-live.model";

export type ScopedSeekerRow = {
  id: string; userId: string; joined: string; profileSignal: Seeker["profileSignal"]; profileCompletion: number;
  status: Seeker["status"]; applied: number; accepted: number; rejected: number; pending: number; servicesAccepted: number;
  source: "Voice" | "QR" | "Bulk" | "Self" | "—";
};
export type ScopedSeekers = { rows: ScopedSeekerRow[]; capped: boolean };
const CAP = 1000;

export async function loadScopedSeekers(instance: string, coordinatorId: string, from?: string | null, to?: string | null, source?: string | null): Promise<ScopedSeekers> {
  const db = blueDotsClient();
  const { data, error } = await db.rpc("get_bluedot_seekers", {
    p_instance: instance, p_coordinator: coordinatorId,
    p_from: from ?? null, p_to: to ?? null, p_source: source ?? null, p_limit: CAP,
  });
  if (error) throw new Error("Couldn't load seekers");
  const all = (data ?? []) as Array<{ item_id: string; joined: string | null; profile_signal: ScopedSeekerRow["profileSignal"]; profile_completion: number; status: ScopedSeekerRow["status"]; applied: number; accepted: number; rejected: number; pending: number; services: number; source: ScopedSeekerRow["source"] }>;
  const capped = all.length > CAP;
  const rows: ScopedSeekerRow[] = all.slice(0, CAP).map(r => ({
    id: r.item_id, userId: "", joined: r.joined ?? "",
    profileSignal: r.profile_signal, profileCompletion: r.profile_completion, status: r.status,
    applied: r.applied, accepted: r.accepted, rejected: r.rejected, pending: r.pending, servicesAccepted: r.services,
    source: r.source,
  }));
  return { rows, capped };
}

export type FieldCompletion = { total: number; role: number; location: number; experience: number; age: number; education: number };

export async function loadFieldCompletion(instance: string, coordinatorId: string, from?: string | null, to?: string | null, source?: string | null): Promise<FieldCompletion> {
  const db = blueDotsClient();
  const { data, error } = await db.rpc("get_bluedot_field_completion", {
    p_instance: instance, p_coordinator: coordinatorId, p_from: from ?? null, p_to: to ?? null, p_source: source ?? null,
  });
  if (error) throw new Error("Couldn't load field completion");
  const r = (Array.isArray(data) ? data[0] : data) as { total: number; role_filled: number; location_filled: number; experience_filled: number; age_filled: number; education_filled: number } | undefined;
  return { total: Number(r?.total ?? 0), role: Number(r?.role_filled ?? 0), location: Number(r?.location_filled ?? 0), experience: Number(r?.experience_filled ?? 0), age: Number(r?.age_filled ?? 0), education: Number(r?.education_filled ?? 0) };
}

export type QrRow = { linkId: string; title: string; location: string | null; eventDate: string | null; status: string; url: string;
  brought: number; brought30d: number; brought7d: number; seekers: number; providers: number;
  liveProfiles: number; applied: number; avgCompleteness: number | null; firstSignup: string | null; lastSignup: string | null };

export async function loadCoordinatorQrs(instance: string, coordinatorId: string): Promise<QrRow[]> {
  const db = blueDotsClient();
  const { data, error } = await db.rpc("get_bluedot_coordinator_qrs", { p_instance: instance, p_coordinator: coordinatorId });
  if (error) throw new Error("Couldn't load QR codes");
  return ((data ?? []) as Array<{ link_id: string; title: string | null; location: string | null; event_date: string | null; status: string | null; registration_url: string | null; brought: number; brought_30d: number; brought_7d: number; seekers: number; providers: number; live_profiles: number; applied: number; avg_completeness: number | null; first_signup: string | null; last_signup: string | null }>).map(r => ({
    linkId: r.link_id, title: (r.title ?? "").trim() || "Untitled QR", location: r.location, eventDate: r.event_date,
    status: r.status ?? "live", url: r.registration_url ?? "", brought: Number(r.brought), brought30d: Number(r.brought_30d),
    brought7d: Number(r.brought_7d), seekers: Number(r.seekers), providers: Number(r.providers),
    liveProfiles: Number(r.live_profiles), applied: Number(r.applied),
    avgCompleteness: r.avg_completeness === null || r.avg_completeness === undefined ? null : Number(r.avg_completeness),
    firstSignup: r.first_signup, lastSignup: r.last_signup,
  }));
}

export type ProviderFieldCompletion = { total: number; role: number; pay: number; positions: number; experience: number; education: number };

export async function loadProviderFieldCompletion(instance: string, coordinatorId: string, from?: string | null, to?: string | null): Promise<ProviderFieldCompletion> {
  const db = blueDotsClient();
  const { data, error } = await db.rpc("get_bluedot_provider_field_completion", {
    p_instance: instance, p_coordinator: coordinatorId, p_from: from ?? null, p_to: to ?? null,
  });
  if (error) throw new Error("Couldn't load provider field completion");
  const r = (Array.isArray(data) ? data[0] : data) as { total: number; role_filled: number; pay_filled: number; positions_filled: number; experience_filled: number; education_filled: number } | undefined;
  return { total: Number(r?.total ?? 0), role: Number(r?.role_filled ?? 0), pay: Number(r?.pay_filled ?? 0), positions: Number(r?.positions_filled ?? 0), experience: Number(r?.experience_filled ?? 0), education: Number(r?.education_filled ?? 0) };
}

export type ProviderRow = {
  id: string; joined: string; signal: "Strong" | "Moderate" | "Weak"; completeness: number;
  status: "New" | "Active" | "Inactive"; postings: number; live: number; applications: number;
  source: "Voice" | "QR" | "Bulk" | "Self" | "—";
};
export type ScopedProviders = { rows: ProviderRow[]; capped: boolean };
const PROVIDER_CAP = 1000;

export async function loadScopedProviders(instance: string, coordinatorId: string, from?: string | null, to?: string | null): Promise<ScopedProviders> {
  const db = blueDotsClient();
  const { data, error } = await db.rpc("get_bluedot_providers", {
    p_instance: instance, p_coordinator: coordinatorId, p_from: from ?? null, p_to: to ?? null, p_limit: PROVIDER_CAP,
  });
  if (error) throw new Error("Couldn't load providers");
  const all = (data ?? []) as Array<{ item_id: string; joined: string | null; provider_signal: ProviderRow["signal"]; completeness: number; status: ProviderRow["status"]; postings: number; live: number; applications: number; source: ProviderRow["source"] }>;
  const capped = all.length > PROVIDER_CAP;
  const rows: ProviderRow[] = all.slice(0, PROVIDER_CAP).map(r => ({
    id: r.item_id, joined: r.joined ?? "", signal: r.provider_signal, completeness: r.completeness,
    status: r.status, postings: r.postings, live: r.live, applications: r.applications, source: r.source,
  }));
  return { rows, capped };
}
