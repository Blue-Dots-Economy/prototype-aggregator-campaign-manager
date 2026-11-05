ALTER TABLE public.bd_users DROP CONSTRAINT bd_users_pkey;
ALTER TABLE public.bd_users ADD PRIMARY KEY(instance,id);
ALTER TABLE public.bd_items DROP CONSTRAINT bd_items_pkey;
ALTER TABLE public.bd_items ADD PRIMARY KEY(instance,item_id);
ALTER TABLE public.bd_item_actions DROP CONSTRAINT bd_item_actions_pkey;
ALTER TABLE public.bd_item_actions ADD PRIMARY KEY(instance,action_id);
ALTER TABLE public.bd_aggregators DROP CONSTRAINT bd_aggregators_pkey;
ALTER TABLE public.bd_aggregators ADD PRIMARY KEY(instance,coordinator_org_id);
CREATE OR REPLACE FUNCTION public.bd_finish_sync(p_run uuid,p_error text DEFAULT NULL) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE stamp timestamptz=now(); t text; k text;
BEGIN
 PERFORM 1 FROM bd_sync_state WHERE id=true AND run_id=p_run FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync lease expired'; END IF;
 IF p_error IS NULL THEN
  FOR t,k IN SELECT * FROM (VALUES ('bd_users','id'),('bd_item_actions','action_id'),('bd_items','item_id'),('bd_aggregators','coordinator_org_id')) v(t,k) LOOP
   EXECUTE format('INSERT INTO %I SELECT r.* FROM jsonb_populate_recordset(NULL::%I,(SELECT coalesce(jsonb_agg(payload || jsonb_build_object(''loaded_at'', $2)),''[]''::jsonb) FROM bd_sync_stage WHERE run_id=$1 AND table_name=$3)) r ON CONFLICT (instance,%I) DO UPDATE SET %s',t,t,k,
    (SELECT string_agg(format('%I=EXCLUDED.%I',column_name,column_name),',') FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name NOT IN(k,'instance'))) USING p_run,stamp,t;
   EXECUTE format('DELETE FROM %I WHERE instance IN (''UP'',''KA'') AND loaded_at <> $1',t) USING stamp;
  END LOOP;
 END IF;
 UPDATE bd_sync_state SET run_id=null,started_at=null,updated_at=CASE WHEN p_error IS NULL THEN stamp ELSE updated_at END,last_error=p_error WHERE id=true;
 DELETE FROM bd_sync_stage WHERE run_id=p_run;
 RETURN stamp;
END $$;