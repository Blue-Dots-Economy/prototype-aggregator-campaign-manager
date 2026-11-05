import { createClient } from "@supabase/supabase-js";
import { blueDotsClient } from "./blue-dots-auth.server";

const specs = [
  { source: "bluedot_users", target: "bd_users", cols: "id,created_at,domains,onboarded_by_org_id,instance", key: "id" },
  { source: "bluedot_item_actions", target: "bd_item_actions", cols: "action_id,source_item_owner,created_at,instance", key: "action_id" },
  { source: "bluedot_items", target: "bd_items", cols: "item_id,created_by,instance", key: "item_id" },
  { source: "bluedot_aggregators", target: "bd_aggregators", cols: "org_id,org_name,coordinator_org_id,coordinator_org_name,coordinator_type,test_flag,instance", key: "coordinator_org_id" },
];
export async function performBlueDotsSync() {
  const url = process.env.NEW_SUPABASE_URL;
  const key = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Live Blue Dots source is unavailable");
  const source = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const local = blueDotsClient();
  const run = crypto.randomUUID();
  const { data: claimed, error: claimError } = await local.rpc("bd_begin_sync", { p_run: run });
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { ok: false, busy: true, updatedAt: null };
  try {
    // All workers settle before releasing the lease, including after a source error.
    const results = await Promise.allSettled(specs.flatMap(spec => ["UP", "KA"].map(async instance => {
      let last: string | null = null;
      for (let pages = 0; pages < 500; pages++) {
        let q = source.from(spec.source).select(spec.cols).eq("instance", instance).order(spec.key).limit(1000);
        if (last) q = q.gt(spec.key, last);
        if (spec.target === "bd_item_actions") q = q.eq("action_type", "apply");
        if (spec.target === "bd_items") q = q.eq("item_type", "job_posting_1.0").eq("lifecycle_status", "live");
        const { data, error } = await q;
        if (error) throw new Error(`${spec.source}: ${error.message}`);
        const rows = (data ?? []) as unknown as Record<string, unknown>[];
        if (!rows.length) return;
        for (let i = 0; i < rows.length; i += 500) {
          const { error: writeError } = await local.from("bd_sync_stage").upsert(rows.slice(i, i + 500).map(row => ({ run_id: run, table_name: spec.target, row_key: String(row[spec.key]), payload: row })), { onConflict: "run_id,table_name,row_key" });
          if (writeError) throw new Error(writeError.message);
        }
        last = String(rows[rows.length - 1][spec.key]);
      }
      throw new Error("Blue Dots source pagination limit exceeded");
    })));
    const failed = results.find(r => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    const { data: updatedAt, error } = await local.rpc("bd_finish_sync", { p_run: run });
    if (error) throw new Error(error.message);
    return { ok: true, busy: false, updatedAt: String(updatedAt) };
  } catch (error) {
    console.error("[blue-dots-sync]", error);
    await local.rpc("bd_finish_sync", { p_run: run, p_error: "Blue Dots update failed" });
    throw new Error("Couldn't update Blue Dots; the previous data is still available");
  }
}