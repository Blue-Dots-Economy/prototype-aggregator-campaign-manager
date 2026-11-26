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
