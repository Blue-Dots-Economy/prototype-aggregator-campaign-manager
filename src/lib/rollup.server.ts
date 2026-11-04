import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Canonical Blue Dots tables live in the campaign-manager project (NEW_SUPABASE_*), public schema.
// Blue Dot → coordinator_org_id → shared org_id. Server-only.
function cmClient(): SupabaseClient<any, any, any> | null {
  const url = process.env.NEW_SUPABASE_URL;
  const key = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

import { buildRollup, resolveAggregator, type AggregatorRow, type UserRow, type ApplyRow, type PostingRow, type DistrictRollup } from "./rollup.model";
export type { DistrictRollup, RollupOrg, RollupCoordinator, RollupMember, RollupStats, Lifecycle } from "./rollup.model";
const PAGE = 1000;

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

  }
  return out;
}

export async function loadDistrictRollup(instance: string, aggregatorId?: string | null, offset = 0, coordinatorId?: string | null): Promise<DistrictRollup> {
  try {
    const sb = cmClient();
    if (!sb || !instance) return { available: false };
    const [arms, users, applies, postings] = await Promise.all([
      readAll<AggregatorRow & Record<string, unknown>>(sb, "bluedot_aggregators", "org_id,org_name,coordinator_org_id,coordinator_type,test_flag", "coordinator_org_id", instance),
      readAll<UserRow & Record<string, unknown>>(sb, "bluedot_users", "id,created_at,domains,onboarded_by_org_id", "id", instance),
      readAll<ApplyRow & Record<string, unknown>>(sb, "bluedot_item_actions", "action_id,source_item_owner,created_at", "action_id", instance, q => q.eq("action_type", "apply")),
      readAll<PostingRow & Record<string, unknown>>(sb, "bluedot_items", "item_id,created_by", "item_id", instance, q => q.eq("item_type", "job_posting_1.0").eq("lifecycle_status", "live")),
    ]);
    const all = buildRollup(arms, users, applies, postings);
    if (coordinatorId) {
      const registered = arms.some(a => a.coordinator_org_id === coordinatorId);
      const org = registered ? all.find(o => o.coordinators.some(c => c.id === coordinatorId)) : undefined;
      const coord = org?.coordinators.find(c => c.id === coordinatorId);
      return { available: true, instance, orgs: org && coord ? [{ ...org, seekers: coord.seekers, providers: coord.providers, livePostings: coord.livePostings, members: coord.members, coordinators: [coord] }] : [], nextOffset: null };
    }
    const scoped = aggregatorId ? resolveAggregator(all, aggregatorId) : all;
    // Bound every server response, including all registered arms of one organisation.
    const orgs = scoped.slice(offset, offset + 2);
    return { available: true, instance, orgs, nextOffset: offset + orgs.length < scoped.length ? offset + orgs.length : null };
  } catch (e) {
    console.error("[rollup] district rollup failed", e);
    return { available: false };
  }
}
