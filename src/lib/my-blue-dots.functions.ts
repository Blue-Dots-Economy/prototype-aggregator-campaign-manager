import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The aggregated journey tables live in the campaign-manager pipeline project
// (NEW_SUPABASE_*), same source the master-cohort pick uses.
function masterClient(): SupabaseClient | null {
  const url = process.env.NEW_SUPABASE_URL;
  const key = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// District label (app_users.district / session.district) -> pipeline `instance` code.
export function instanceForDistrict(district?: string | null): string | null {
  const d = (district || "").trim().toLowerCase();
  if (!d) return null;
  if (d === "up" || d === "ka") return d.toUpperCase();
  if (d.includes("ghaz") || d.includes("gzb")) return "UP";
  if (d.includes("dharwad") || d.includes("hubli") || d.includes("karnataka")) return "KA";
  return null;
}

const maskPhone = (p?: string | null) => {
  const s = String(p ?? "").replace(/\D/g, "");
  if (s.length < 4) return s ? "••••" : "—";
  return "•••••" + s.slice(-4);
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface BlueDot {
  id: string; name: string; phone_masked: string; kind: "seeker" | "provider";
  region: string; instance: string;
  calls: number; campaigns: number; applications: number;
  everApplied: boolean; everAnswered: boolean; everEngaged: boolean;
  intent: number | null; confidence: number | null;
  agent: string; onboardedAt: string | null; lastCallDate: string | null;
}
export interface MyBlueDotsSummary {
  total: number; seekers: number; providers: number;
  applied: number; answered: number; engaged: number; onboarded30: number;
}
const emptySummary = (): MyBlueDotsSummary => ({ total: 0, seekers: 0, providers: 0, applied: 0, answered: 0, engaged: 0, onboarded30: 0 });

function summarize(dots: BlueDot[]): MyBlueDotsSummary {
  const now = Date.now();
  const s = emptySummary();
  s.total = dots.length;
  for (const d of dots) {
    if (d.kind === "seeker") s.seekers++; else s.providers++;
    if (d.everApplied) s.applied++;
    if (d.everAnswered) s.answered++;
    if (d.everEngaged) s.engaged++;
    const t = d.onboardedAt ? new Date(d.onboardedAt).getTime() : NaN;
    if (Number.isFinite(t) && (now - t) / 86400000 <= 30) s.onboarded30++;
  }
  return s;
}

// Keyset pagination on `id` — immune to PostgREST row caps.
async function fetchAll(sb: SupabaseClient, table: string, inst: string, kind: "seeker" | "provider", cols: string): Promise<BlueDot[]> {
  const out: BlueDot[] = [];
  const page = 1000;
  let last: string | null = null;
  for (;;) {
    let q = sb.from(table).select(cols).eq("in_bluedot", true).eq("instance", inst).order("id", { ascending: true }).limit(page);
    if (last !== null) q = q.gt("id", last);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    for (const r of rows) {
      out.push({
        id: String(r.id),
        name: String(r.bluedot_name || r.seeker_name || r.provider_name || r.employer_name || "—"),
        phone_masked: maskPhone((r.phone ?? r.phone_number) as string | null),
        kind,
        region: String(r.jfc_campaign || "—"),
        instance: String(r.instance || inst),
        calls: num(r.total_calls_made) ?? 0,
        campaigns: num(r.total_campaigns) ?? 0,
        applications: num(r.total_application) ?? 0,
        everApplied: !!r.ever_applied,
        everAnswered: !!r.ever_answered,
        everEngaged: !!r.ever_engaged,
        intent: num(r.avg_intent_score),
        confidence: num(r.call_confidence_score),
        agent: String(r.agent_name || "—"),
        onboardedAt: (r.onboarded_at as string) || null,
        lastCallDate: (r.last_call_date as string) || null,
      });
    }
    if (rows.length < page) break;
    last = String(rows[rows.length - 1].id);
  }
  return out;
}

export const fetchMyBlueDots = createServerFn({ method: "POST" })
  .inputValidator((d: { district?: string | null }) => d)
  .handler(async ({ data }): Promise<{ available: boolean; instance: string | null; dots: BlueDot[]; summary: MyBlueDotsSummary }> => {
    const inst = instanceForDistrict(data.district);
    const sb = masterClient();
    if (!sb || !inst) return { available: false, instance: inst, dots: [], summary: emptySummary() };

    const seekerCols = "id,phone,bluedot_name,seeker_name,jfc_campaign,instance,total_calls_made,total_campaigns,total_application,ever_applied,ever_answered,ever_engaged,avg_intent_score,call_confidence_score,agent_name,onboarded_at,last_call_date,in_bluedot";
    // Provider journey schema may differ — keep its column set minimal & safe.
    const providerCols = "id,phone,bluedot_name,jfc_campaign,instance,total_calls_made,total_campaigns,agent_name,onboarded_at,in_bluedot";

    let seekers: BlueDot[] = [];
    let providers: BlueDot[] = [];
    try { seekers = await fetchAll(sb, "aggregated_seeker_journey", inst, "seeker", seekerCols); } catch { seekers = []; }
    try { providers = await fetchAll(sb, "aggregated_provider_journey", inst, "provider", providerCols); } catch { providers = []; }

    const dots = [...seekers, ...providers];
    return { available: true, instance: inst, dots, summary: summarize(dots) };
  });
