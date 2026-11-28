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
