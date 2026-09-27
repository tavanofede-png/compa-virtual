-- Host authority follows a live room lease. This metadata is operational and
-- never appears in the student's academic state or room response.
create table private.shared_room_host_leases (
  session_id uuid primary key references public.group_study_sessions on delete cascade,
  host_id uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null
);
create index shared_room_host_leases_expiry on private.shared_room_host_leases(expires_at);
alter table private.shared_room_host_leases enable row level security;
revoke all on private.shared_room_host_leases from public, anon, authenticated;
grant all on private.shared_room_host_leases to service_role;

insert into private.shared_room_host_leases(session_id, host_id, expires_at)
select s.id, s.host_id, coalesce(r.expires_at, now() + interval '75 seconds')
from public.group_study_sessions s
left join private.shared_room_presence r on r.session_id = s.id and r.user_id = s.host_id
where s.status = 'active' and s.host_id is not null;

create function private.shared_room_host_lease_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('completed', 'cancelled') then
    delete from private.shared_room_host_leases where session_id = new.id;
  elsif new.status = 'active' and new.host_id is not null
    and (old.status <> 'active' or new.host_id is distinct from old.host_id) then
    insert into private.shared_room_host_leases(session_id, host_id, expires_at)
    values(new.id, new.host_id, coalesce((select r.expires_at
      from private.shared_room_presence r
      where r.session_id = new.id and r.user_id = new.host_id and r.expires_at > now()),
      now() + interval '75 seconds'))
    on conflict(session_id) do update set host_id = excluded.host_id,
      expires_at = case
        when private.shared_room_host_leases.host_id = excluded.host_id
          then greatest(private.shared_room_host_leases.expires_at, excluded.expires_at)
        else excluded.expires_at end;
  end if;
  return new;
end $$;
revoke all on function private.shared_room_host_lease_sync() from public, anon, authenticated;
create trigger shared_room_host_lease_sync after update of status, host_id
on public.group_study_sessions for each row execute function private.shared_room_host_lease_sync();

create function private.reconcile_shared_room_host(p_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  s public.group_study_sessions;
  lease private.shared_room_host_leases;
  live_expiry timestamptz;
  successor uuid;
begin
  -- Match room command lock order: parent group, then session, then lease.
  perform 1 from public.study_groups
    where id = (select group_id from public.group_study_sessions where id = p_session)
    for update;
  select * into s from public.group_study_sessions where id = p_session for update;
  if not found or s.status <> 'active' or s.host_id is null then return false; end if;
  select * into lease from private.shared_room_host_leases
    where session_id = p_session for update;
  if not found or lease.host_id <> s.host_id or lease.expires_at > now()
    then return false; end if;
  select r.expires_at into live_expiry from private.shared_room_presence r
    where r.session_id = p_session and r.user_id = s.host_id and r.expires_at > now();
  if found then
    update private.shared_room_host_leases set expires_at = live_expiry
      where session_id = p_session;
    return false;
  end if;
  select p.user_id into successor from public.group_session_participants p
    join private.shared_room_presence r
      on r.session_id = p.session_id and r.user_id = p.user_id
    where p.session_id = p_session and p.user_id <> s.host_id and r.expires_at > now()
    order by p.joined_at, p.user_id limit 1;
  if not found then return false; end if;
  update public.group_study_sessions set host_id = successor, revision = revision + 1
    where id = p_session;
  return true;
end $$;
revoke all on function private.reconcile_shared_room_host(uuid) from public, anon, authenticated;
grant execute on function private.reconcile_shared_room_host(uuid) to service_role;

create function private.reconcile_shared_room_hosts() returns integer
language plpgsql security definer set search_path = '' as $$
declare sid uuid; changed integer := 0;
begin
  for sid in select l.session_id from private.shared_room_host_leases l
    join public.group_study_sessions s on s.id = l.session_id
    where s.status = 'active' and l.expires_at <= now()
    order by l.session_id loop
    if private.reconcile_shared_room_host(sid) then changed := changed + 1; end if;
  end loop;
  return changed;
end $$;
revoke all on function private.reconcile_shared_room_hosts() from public, anon, authenticated;
grant execute on function private.reconcile_shared_room_hosts() to service_role;
do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('compa-shared-room-host-recovery', '* * * * *',
      'select private.reconcile_shared_room_hosts()');
  end if;
end $$;

-- Keep the established one-room-per-account wrapper, then reconcile after a
-- participant's presence changes. A disconnected host never blocks the timer.
alter function public.shared_room_command(uuid,uuid,jsonb,jsonb) rename to shared_room_command_room_limit;
create function public.shared_room_command(
  p_user uuid, p_operation uuid, p_command jsonb, p_appearance jsonb default '{}'
) returns jsonb language plpgsql set search_path = '' as $$
declare
  sid uuid := (p_command->>'session_id')::uuid;
  action text := p_command->>'action';
  result jsonb;
  host uuid;
  lease_expiry timestamptz;
begin
  result := public.shared_room_command_room_limit(p_user, p_operation, p_command, p_appearance);
  if action in ('room.enter', 'room.heartbeat', 'room.leave') then
    select host_id into host from public.group_study_sessions where id = sid;
    if host = p_user then
      if action = 'room.leave' then
        lease_expiry := now();
      else
        select expires_at into lease_expiry from private.shared_room_presence
          where session_id = sid and user_id = p_user and expires_at > now();
      end if;
      if lease_expiry is not null then
        insert into private.shared_room_host_leases(session_id, host_id, expires_at)
          values(sid, host, lease_expiry)
          on conflict(session_id) do update set host_id = excluded.host_id,
            expires_at = excluded.expires_at;
      end if;
    end if;
    perform private.reconcile_shared_room_host(sid);
  end if;
  return result;
end $$;
revoke all on function public.shared_room_command(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.shared_room_command(uuid,uuid,jsonb,jsonb) to service_role;
