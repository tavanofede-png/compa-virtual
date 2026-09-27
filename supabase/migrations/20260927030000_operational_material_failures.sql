-- A one-attempt terminal material error is an expected document/configuration
-- outcome. The worker retries unexpected processing failures up to three times.
-- Only exhausted processing failures should open the operational alert.
create or replace function public.operational_scan() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare signal record; was_active boolean; heartbeat_age interval;
  material_stalled integer; material_failed integer; cleanup_stale integer;
  push_failed integer; urgent_support integer; chat_reports integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(71007001);
  select now()-last_seen_at into heartbeat_age from private.worker_heartbeats where worker_name='materials';
  select count(*)::int into material_stalled from public.material_jobs
    where phase in ('WAITING','EXTRACTING','OCR','INDEXING') and updated_at<now()-interval '15 minutes';
  select count(*)::int into material_failed from public.material_jobs
    where phase='FAILED' and attempts>=3;
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
