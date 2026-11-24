import { createClient } from "@supabase/supabase-js";
import { getCookie } from "@tanstack/react-start/server";
import { jwtVerify } from "jose";
import { aggregateActions, mapLiveProfile, summarizeSeekers, type ApplyAction, type LiveProfile } from "./my-blue-dots-live.model";

// This read path authorizes the credential, not the browser's selected role or instance.
async function authorizeInstance(instance: string) {
  const token = getCookie("bd_session");
  const secret = process.env['BD_SESSION_SECRET'];
  if (!token || !secret) throw new Error("Please sign in again to view Blue Dots.");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
  if (typeof payload.email !== "string") throw new Error("Unauthorized");
  const { sbForAuth } = await import("./db.server");
  const { data: actor, error } = await sbForAuth().from("app_users").select("role,district,active").eq("email", payload.email).maybeSingle();
  if (error || !actor || !actor.active) throw new Error("Unauthorized");
  if (actor.role === "admin") return;
  if (!["user", "ecosystem", "jfc", "jfc_readonly"].includes(actor.role)) throw new Error("Unauthorized");
  const district = (actor.district ?? "").toLowerCase();
  const scoped = /ghaz|gzb|^up$/.test(district) ? "UP" : /dharwad|hubli|karnataka|^ka$/.test(district) ? "KA" : null;
  if (!scoped || scoped !== instance) throw new Error("Unauthorized instance");
}

export async function loadLiveProfileSlice(input: { instance: string; after: string | null; asOf: string | null }) {
  await authorizeInstance(input.instance);
  const url = process.env['NEW_SUPABASE_URL'];
  const key = process.env['NEW_SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error("Blue Dots source is unavailable.");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const asOf = input.asOf ?? new Date().toISOString();
  let query = sb.from("bluedot_seeker_profiles")
    .select("item_id,created_by,created_at,role_wanted_raw,age_masked,education_category,work_experience,is_default_geo,instance")
    .eq("instance", input.instance).order("item_id", { ascending: true }).limit(500);
  if (input.after !== null) query = query.gt("item_id", input.after);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load live Blue Dots profiles.");
  const profiles = (data ?? []) as LiveProfile[];
  const actions: ApplyAction[] = [];
  // Read the source-ID interval covered by this profile slice, avoiding long IN URLs
  // and repeated scans. Unmatched actions in that interval do not map to any profile.
  const first = profiles[0];
  const final = profiles.at(-1);
  if (first && final) {
    let after: string | null = null;
    for (;;) {
      let q = sb.from("bluedot_item_actions").select("action_id,source_item_id,action_status,created_at,instance")
        .eq("instance", input.instance).eq("action_type", "apply")
        .gte("source_item_id", first.item_id).lte("source_item_id", final.item_id)
        .order("action_id", { ascending: true }).limit(1000);
      if (after !== null) q = q.gt("action_id", after);
      const result = await q;
      if (result.error) throw new Error("Unable to load live Blue Dots applications.");
      const rows = (result.data ?? []) as ApplyAction[];
      const last = rows.at(-1);
      if (!last) break;
      actions.push(...rows);
      after = last.action_id;
    }
  }
  const counts = aggregateActions(actions);
  const seekers = profiles.map(p => mapLiveProfile(p, counts, Date.parse(asOf)));
  return { seekers, summary: summarizeSeekers(seekers), asOf, nextCursor: profiles.at(-1)?.item_id ?? null };
}