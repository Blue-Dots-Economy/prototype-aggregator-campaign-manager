CREATE TABLE public.bd_users(id text PRIMARY KEY, instance text NOT NULL, created_at timestamptz, domains text[], onboarded_by_org_id text, loaded_at timestamptz NOT NULL);
GRANT ALL ON public.bd_users TO service_role;
ALTER TABLE public.bd_users ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.bd_item_actions(action_id text PRIMARY KEY, instance text NOT NULL, source_item_owner text, created_at timestamptz, loaded_at timestamptz NOT NULL);
GRANT ALL ON public.bd_item_actions TO service_role;
ALTER TABLE public.bd_item_actions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.bd_items(item_id text PRIMARY KEY, instance text NOT NULL, created_by text, loaded_at timestamptz NOT NULL);
GRANT ALL ON public.bd_items TO service_role;
ALTER TABLE public.bd_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.bd_aggregators(coordinator_org_id text PRIMARY KEY, instance text NOT NULL, org_id text, org_name text, coordinator_org_name text, coordinator_type text, test_flag boolean, loaded_at timestamptz NOT NULL);
GRANT ALL ON public.bd_aggregators TO service_role;
ALTER TABLE public.bd_aggregators ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.bd_users(instance);
CREATE INDEX ON public.bd_users(onboarded_by_org_id);
CREATE INDEX ON public.bd_item_actions(source_item_owner);
CREATE INDEX ON public.bd_items(created_by);
CREATE INDEX ON public.bd_aggregators(instance);
CREATE INDEX ON public.bd_aggregators(org_id);
CREATE TABLE public.bd_sync_state(id boolean PRIMARY KEY DEFAULT true, run_id uuid, started_at timestamptz, updated_at timestamptz, sync_token text DEFAULT encode(gen_random_bytes(32),'hex'), last_error text);
GRANT ALL ON public.bd_sync_state TO service_role;
ALTER TABLE public.bd_sync_state ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.bd_sync_stage(run_id uuid NOT NULL, table_name text NOT NULL, row_key text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(run_id,table_name,row_key));
GRANT ALL ON public.bd_sync_stage TO service_role;
ALTER TABLE public.bd_sync_stage ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.bd_begin_sync(p_run uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO bd_sync_state(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE bd_sync_state SET run_id=p_run,started_at=now(),last_error=null WHERE id=true AND (run_id IS NULL OR started_at < now()-interval '20 minutes');
 IF NOT FOUND THEN RETURN false; END IF;
 DELETE FROM bd_sync_stage WHERE run_id <> p_run;
 RETURN true;
END $$;
CREATE FUNCTION public.bd_finish_sync(p_run uuid,p_error text DEFAULT NULL) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE stamp timestamptz=now(); t text; k text;
BEGIN
 PERFORM 1 FROM bd_sync_state WHERE id=true AND run_id=p_run FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync lease expired'; END IF;
 IF p_error IS NULL THEN
  FOR t,k IN SELECT * FROM (VALUES ('bd_users','id'),('bd_item_actions','action_id'),('bd_items','item_id'),('bd_aggregators','coordinator_org_id')) v(t,k) LOOP
   EXECUTE format('INSERT INTO %I SELECT r.* FROM jsonb_populate_recordset(NULL::%I,(SELECT coalesce(jsonb_agg(payload || jsonb_build_object(''loaded_at'', $2)),''[]''::jsonb) FROM bd_sync_stage WHERE run_id=$1 AND table_name=$3)) r ON CONFLICT (%I) DO UPDATE SET %s',t,t,k,
    (SELECT string_agg(format('%I=EXCLUDED.%I',column_name,column_name),',') FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name<>k)) USING p_run,stamp,t;
   EXECUTE format('DELETE FROM %I WHERE instance IN (''UP'',''KA'') AND loaded_at <> $1',t) USING stamp;
  END LOOP;
 END IF;
 UPDATE bd_sync_state SET run_id=null,started_at=null,updated_at=CASE WHEN p_error IS NULL THEN stamp ELSE updated_at END,last_error=p_error WHERE id=true;
 DELETE FROM bd_sync_stage WHERE run_id=p_run;
 RETURN stamp;
END $$;
CREATE FUNCTION public.bd_arm_catalog(p_instance text) RETURNS TABLE(org_id text,org_name text,coordinator_org_id text,coordinator_org_name text,coordinator_type text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH excluded AS (SELECT DISTINCT a.org_id FROM bd_aggregators a WHERE a.instance=p_instance AND (a.test_flag IS TRUE OR a.org_name ~* 'test_marker|test\y|temp\s*-\s*sp|aryan test')),
 registered AS (SELECT a.org_id,a.org_name,a.coordinator_org_id,a.coordinator_org_name,a.coordinator_type FROM bd_aggregators a WHERE a.instance=p_instance AND NOT EXISTS(SELECT 1 FROM excluded e WHERE e.org_id=a.org_id))
 SELECT * FROM registered
 UNION ALL
 SELECT DISTINCT coalesce(nullif(u.onboarded_by_org_id,''),'unattributed'),coalesce(nullif(u.onboarded_by_org_id,''),'unattributed'),coalesce(nullif(u.onboarded_by_org_id,''),'unattributed'),null::text,null::text FROM bd_users u WHERE u.instance=p_instance AND u.domains && ARRAY['seeker','provider'] AND NOT EXISTS(SELECT 1 FROM bd_aggregators a WHERE a.instance=p_instance AND a.coordinator_org_id=coalesce(nullif(u.onboarded_by_org_id,''),'unattributed'));
$$;
CREATE FUNCTION public.bd_participant_facts(p_instance text,p_ids text[] DEFAULT NULL) RETURNS TABLE(id text,coordinator_org_id text,joined timestamptz,kind text,applications bigint,live_postings bigint,lifecycle text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH users AS MATERIALIZED (SELECT u.* FROM bd_users u WHERE u.instance=p_instance AND (p_ids IS NULL OR u.id=ANY(p_ids))),
 apps AS (SELECT a.source_item_owner,count(*) n,max(a.created_at) last_apply FROM bd_item_actions a JOIN users u ON u.id=a.source_item_owner WHERE a.instance=p_instance GROUP BY a.source_item_owner),
 postings AS (SELECT i.created_by,count(*) n FROM bd_items i JOIN users u ON u.id=i.created_by WHERE i.instance=p_instance GROUP BY i.created_by)
 SELECT u.id,coalesce(nullif(u.onboarded_by_org_id,''),'unattributed'),u.created_at,k.kind,
 CASE WHEN k.kind='seeker' THEN coalesce(a.n,0) ELSE 0 END,CASE WHEN k.kind='provider' THEN coalesce(p.n,0) ELSE 0 END,
 CASE WHEN u.created_at >= now()-interval '7 days' THEN 'New' WHEN k.kind='provider' THEN CASE WHEN coalesce(p.n,0)>0 THEN 'Active' ELSE 'Inactive' END WHEN a.last_apply >= now()-interval '30 days' THEN 'Active' WHEN a.last_apply >= now()-interval '90 days' THEN 'At Risk' ELSE 'Inactive' END
 FROM users u CROSS JOIN (VALUES('seeker'),('provider')) k(kind) LEFT JOIN apps a ON a.source_item_owner=u.id LEFT JOIN postings p ON p.created_by=u.id WHERE k.kind=ANY(u.domains);
$$;
CREATE FUNCTION public.get_bluedot_rollup(p_instance text) RETURNS TABLE(org_id text,org_name text,coordinator_org_id text,coordinator_org_name text,coordinator_type text,s_total bigint,s_new bigint,s_active bigint,s_at_risk bigint,s_inactive bigint,s_applied bigint,p_total bigint,p_new bigint,p_active bigint,p_inactive bigint,p_live_postings bigint,updated_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.org_id,c.org_name,c.coordinator_org_id,c.coordinator_org_name,c.coordinator_type,
 count(f.id) FILTER(WHERE kind='seeker'),count(f.id) FILTER(WHERE kind='seeker' AND lifecycle='New'),count(f.id) FILTER(WHERE kind='seeker' AND lifecycle='Active'),count(f.id) FILTER(WHERE kind='seeker' AND lifecycle='At Risk'),count(f.id) FILTER(WHERE kind='seeker' AND lifecycle='Inactive'),count(f.id) FILTER(WHERE kind='seeker' AND applications>0),
 count(f.id) FILTER(WHERE kind='provider'),count(f.id) FILTER(WHERE kind='provider' AND lifecycle='New'),count(f.id) FILTER(WHERE kind='provider' AND lifecycle='Active'),count(f.id) FILTER(WHERE kind='provider' AND lifecycle='Inactive'),coalesce(sum(live_postings) FILTER(WHERE kind='provider'),0), (SELECT s.updated_at FROM bd_sync_state s WHERE id=true)
 FROM bd_arm_catalog(p_instance) c LEFT JOIN bd_participant_facts(p_instance) f ON f.coordinator_org_id=c.coordinator_org_id GROUP BY c.org_id,c.org_name,c.coordinator_org_id,c.coordinator_org_name,c.coordinator_type;
$$;
CREATE FUNCTION public.get_bluedot_members(p_instance text,p_org_id text DEFAULT NULL,p_coordinator_id text DEFAULT NULL,p_kind text DEFAULT 'all') RETURNS TABLE(id text,joined timestamptz,kind text,applications bigint,live_postings bigint,lifecycle text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH arms AS (SELECT c.coordinator_org_id FROM bd_arm_catalog(p_instance) c WHERE (p_org_id IS NULL OR c.org_id=p_org_id OR c.org_id=(SELECT x.org_id FROM bd_arm_catalog(p_instance) x WHERE x.coordinator_org_id=p_org_id LIMIT 1)) AND (p_coordinator_id IS NULL OR c.coordinator_org_id=p_coordinator_id)),
 ids AS (SELECT DISTINCT selected.id FROM (SELECT u.id FROM bd_users u WHERE u.instance=p_instance AND coalesce(nullif(u.onboarded_by_org_id,''),'unattributed') IN(SELECT coordinator_org_id FROM arms) AND 'seeker'=ANY(u.domains) AND p_kind IN('all','seeker') ORDER BY u.id LIMIT 150) selected UNION SELECT DISTINCT selected.id FROM (SELECT u.id FROM bd_users u WHERE u.instance=p_instance AND coalesce(nullif(u.onboarded_by_org_id,''),'unattributed') IN(SELECT coordinator_org_id FROM arms) AND 'provider'=ANY(u.domains) AND p_kind IN('all','provider') ORDER BY u.id LIMIT 150) selected)
 SELECT f.id,f.joined,f.kind,f.applications,f.live_postings,f.lifecycle FROM bd_participant_facts(p_instance,ARRAY(SELECT ids.id FROM ids)) f WHERE p_kind='all' OR f.kind=p_kind ORDER BY f.id,f.kind;
$$;
REVOKE ALL ON FUNCTION public.bd_begin_sync(uuid),public.bd_finish_sync(uuid,text),public.bd_arm_catalog(text),public.bd_participant_facts(text,text[]),public.get_bluedot_rollup(text),public.get_bluedot_members(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bd_begin_sync(uuid),public.bd_finish_sync(uuid,text),public.bd_arm_catalog(text),public.bd_participant_facts(text,text[]),public.get_bluedot_rollup(text),public.get_bluedot_members(text,text,text,text) TO service_role;