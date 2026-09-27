-- Internal operational signals contain counts and timestamps only, never student content.
create table private.worker_heartbeats (
  worker_name text primary key check(worker_name='materials'),
  boot_id uuid not null,
  pipeline_version integer not null check(pipeline_version>0),
  state text not null check(state in ('idle','processing','stopping')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table private.operational_alerts (
  code text primary key,
  severity text not null check(severity in ('warning','critical')),
  active boolean not null,
  observed_count integer not null check(observed_count>=0),
  opened_at timestamptz not null,
  last_seen_at timestamptz not null,
  resolved_at timestamptz
);
create table private.operational_alert_events (
  id bigint generated always as identity primary key,
  code text not null,
  event text not null check(event in ('opened','resolved')),
  severity text not null,
  observed_count integer not null,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['worker_heartbeats','operational_alerts','operational_alert_events'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated',t);
    execute format('grant all on private.%I to service_role',t);
  end loop;
end $$;
grant usage,select on sequence private.operational_alert_events_id_seq to service_role;

create function public.worker_heartbeat(p_worker text,p_boot uuid,p_pipeline integer,p_state text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_worker<>'materials' or p_boot is null or p_pipeline is null or p_pipeline<1 or
    p_state not in ('idle','processing','stopping') then raise exception 'WORKER_HEARTBEAT_INVALID'; end if;
  insert into private.worker_heartbeats(worker_name,boot_id,pipeline_version,state)
    values(p_worker,p_boot,p_pipeline,p_state)
    on conflict(worker_name) do update set boot_id=excluded.boot_id,
      pipeline_version=excluded.pipeline_version,state=excluded.state,
      started_at=case when worker_heartbeats.boot_id=excluded.boot_id
        then worker_heartbeats.started_at else now() end,
      last_seen_at=now();
end;
$$;
revoke all on function public.worker_heartbeat(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.worker_heartbeat(text,uuid,integer,text) to service_role;

create function public.operational_health_read() returns jsonb
language sql volatile set search_path = '' as $$
  select jsonb_build_object('schema_contract','20260927020000','checked_at',now(),
    'worker',(select to_jsonb(w) from private.worker_heartbeats w where worker_name='materials'),
    'alerts',coalesce((select jsonb_agg(to_jsonb(a) order by a.severity,a.opened_at)
      from private.operational_alerts a where active),'[]'::jsonb),
    'recent_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc)
      from (select id,code,event,severity,observed_count,created_at
        from private.operational_alert_events order by created_at desc,id desc limit 30) e),'[]'::jsonb));
$$;
revoke all on function public.operational_health_read() from public,anon,authenticated;
grant execute on function public.operational_health_read() to service_role;

create function public.operational_scan() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare signal record; was_active boolean; heartbeat_age interval;
  material_stalled integer; material_failed integer; cleanup_stale integer;
  push_failed integer; urgent_support integer; chat_reports integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(71007001);
  select now()-last_seen_at into heartbeat_age from private.worker_heartbeats where worker_name='materials';
  select count(*)::int into material_stalled from public.material_jobs
    where phase in ('WAITING','EXTRACTING','OCR','INDEXING') and updated_at<now()-interval '15 minutes';
  select count(*)::int into material_failed from public.material_jobs where phase='FAILED';
  select count(*)::int into cleanup_stale from public.material_object_deletions
    where created_at<now()-interval '1 hour';
  select count(*)::int into push_failed from public.push_deliveries
    where status='FAILED' and created_at>now()-interval '1 hour';
  select count(*)::int into urgent_support from private.support_tickets
    where priority='urgent' and status<>'resolved';
  select count(*)::int into chat_reports from private.group_chat_reports where status='open';

  for signal in select * from (values
    ('worker_stale','critical',case when heartbeat_age>interval '3 minutes' then 1 else 0 end),
    ('material_stalled','warning',material_stalled),
    ('material_failed','warning',material_failed),
    ('storage_cleanup_stale','warning',cleanup_stale),
    ('push_failures','warning',case when push_failed>=5 then push_failed else 0 end),
    ('urgent_support','critical',urgent_support),
    ('chat_reports','critical',chat_reports)
  ) as s(code,severity,observed_count) loop
    select active into was_active from private.operational_alerts where code=signal.code for update;
    if signal.observed_count>0 then
      insert into private.operational_alerts(code,severity,active,observed_count,opened_at,last_seen_at,resolved_at)
        values(signal.code,signal.severity,true,signal.observed_count,now(),now(),null)
        on conflict(code) do update set active=true,observed_count=excluded.observed_count,
          severity=excluded.severity,last_seen_at=now(),resolved_at=null,
          opened_at=case when operational_alerts.active then operational_alerts.opened_at else now() end;
      if was_active is distinct from true then
        insert into private.operational_alert_events(code,event,severity,observed_count)
          values(signal.code,'opened',signal.severity,signal.observed_count);
      end if;
    elsif was_active is true then
      update private.operational_alerts set active=false,observed_count=0,
        last_seen_at=now(),resolved_at=now() where code=signal.code;
      insert into private.operational_alert_events(code,event,severity,observed_count)
        values(signal.code,'resolved',signal.severity,0);
    end if;
  end loop;
  return public.operational_health_read();
end;
$$;
revoke all on function public.operational_scan() from public,anon,authenticated;
grant execute on function public.operational_scan() to service_role;

do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('kusiy-operational-scan','*/5 * * * *',
      'select public.operational_scan()');
  end if;
end $$;
