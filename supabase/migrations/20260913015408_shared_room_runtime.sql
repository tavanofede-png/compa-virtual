-- Operational leases never enter the student's academic aggregate.
create table private.shared_room_presence (
 session_id uuid not null, user_id uuid not null, connection_id uuid not null,
 expires_at timestamptz not null, seat_id text check(seat_id ~ '^SEAT_0[1-6]$'),
 activity text not null default 'available' check(activity in ('available','focused','break')),
 hand_raised boolean not null default false,
 reaction text check(reaction in ('hello','thanks','idea','agree','celebrate','question')),
 reaction_at timestamptz, appearance jsonb not null default '{}',
 primary key(session_id,user_id), unique(session_id,seat_id),
 foreign key(session_id,user_id) references public.group_session_participants on delete cascade
);
create index shared_room_presence_expiry on private.shared_room_presence(expires_at);
create table private.shared_room_timers (
 session_id uuid primary key references public.group_study_sessions on delete cascade,
 phase text not null default 'focus' check(phase in ('focus','break')),
 running boolean not null default false, deadline timestamptz,
 remaining_seconds integer not null default 1500 check(remaining_seconds between 0 and 10800),
 revision integer not null default 0
);
create table private.shared_room_goals (
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.group_study_sessions on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),done boolean not null default false,
 created_by uuid references auth.users on delete set null,revision integer not null default 0,created_at timestamptz not null default now()
);
create index shared_room_goals_session on private.shared_room_goals(session_id,created_at);
do $$ declare t text; begin
 foreach t in array array['shared_room_presence','shared_room_timers','shared_room_goals'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('grant all on private.%I to service_role',t);
 end loop;
end $$;

-- Broadcast only a content-free invalidation. Revoked sockets never receive
-- session content; the subsequent authenticated read always rechecks access.
create function private.shared_room_notify(p_session uuid,p_extra uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare peer uuid;begin
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return;end if;
 for peer in select user_id from public.group_session_participants where session_id=p_session
  union select p_extra where p_extra is not null loop
  execute 'select realtime.send($1,$2,$3,true)' using '{}'::jsonb,'changed','compa-social:'||peer::text;
 end loop;
end $$;
revoke all on function private.shared_room_notify(uuid,uuid) from public,anon,authenticated;
grant execute on function private.shared_room_notify(uuid,uuid) to service_role;

-- A personal subscription is receive-only. No client can forge room events.
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'create policy compa_social_receive on realtime.messages for select to authenticated using (
   extension=''broadcast'' and topic=''compa-social:''||(select auth.uid())::text)';
 end if;
end $$;

create function private.shared_room_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare sid uuid; extra uuid;begin
 if tg_table_name='group_study_sessions' then
  sid:=new.id;
  if new.status in ('completed','cancelled') then
   delete from private.shared_room_presence where session_id=sid;
   update private.shared_room_timers set running=false,remaining_seconds=greatest(0,coalesce(extract(epoch from deadline-now())::integer,remaining_seconds)),deadline=null,revision=revision+1 where session_id=sid;
  end if;
 elsif tg_op='DELETE' then sid:=old.session_id;extra:=old.user_id;
 else sid:=new.session_id;extra:=new.user_id;
 end if;
 perform private.shared_room_notify(sid,extra);return coalesce(new,old);
end $$;
revoke all on function private.shared_room_changed() from public,anon,authenticated;
create trigger shared_room_session_changed after update on public.group_study_sessions for each row execute function private.shared_room_changed();
create trigger shared_room_members_changed after insert or delete on public.group_session_participants for each row execute function private.shared_room_changed();

alter function public.collaboration_read(uuid,uuid) rename to collaboration_read_base;
create function public.collaboration_read(p_user uuid,p_session uuid default null) returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb;begin
 result:=public.collaboration_read_base(p_user,p_session);
 if p_session is null then return result;end if;
 return result||jsonb_build_object('room',jsonb_build_object(
  'presence',(select coalesce(jsonb_agg(jsonb_build_object('user_id',r.user_id,'seat_id',r.seat_id,
    'expires_at',r.expires_at,'activity',r.activity,'hand_raised',r.hand_raised,'appearance',r.appearance,
    'reaction',case when r.reaction_at>now()-interval '5 seconds' then r.reaction else null end,
    'reaction_at',r.reaction_at) order by r.user_id),'[]')
   from private.shared_room_presence r join public.group_session_participants p using(session_id,user_id)
   where r.session_id=p_session and r.expires_at>now()),
  'timer',(select to_jsonb(t)-'session_id' from private.shared_room_timers t where t.session_id=p_session),
  'goals',(select coalesce(jsonb_agg(to_jsonb(g)-'session_id' order by g.created_at),'[]') from private.shared_room_goals g where g.session_id=p_session)));
end $$;
revoke all on function public.collaboration_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.collaboration_read(uuid,uuid) to service_role;

create function public.shared_room_command(p_user uuid,p_operation uuid,p_command jsonb,p_appearance jsonb default '{}') returns jsonb
language plpgsql set search_path='' as $$
declare
 sid uuid:=(p_command->>'session_id')::uuid;action text:=p_command->>'action';
 conn uuid:=(p_command->>'connection_id')::uuid;s public.group_study_sessions;r private.shared_room_presence;
 timer private.shared_room_timers;goal private.shared_room_goals;op private.collaboration_operations;
 result jsonb;chosen text;notify boolean:=true;affected integer;
begin
 if p_operation is null then raise exception 'COLLAB_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,718));
 -- Same lock order as existing commands: account, parent group, session.
 perform 1 from public.study_groups where id=(select group_id from public.group_study_sessions where id=sid) for update;
 select * into s from public.group_study_sessions where id=sid for update;
 if not found or not exists(select 1 from public.group_session_participants where session_id=sid and user_id=p_user)
 then raise exception 'COLLAB_NOT_FOUND';end if;
 -- Even idempotent retries must revalidate membership before returning.
 select * into op from private.collaboration_operations where user_id=p_user and operation_id=p_operation;
 if found then
  if op.command<>p_command then raise exception 'COLLAB_CONFLICT';end if;
  return op.result;
 end if;
 if s.status not in ('scheduled','active') then raise exception 'COLLAB_STATE';end if;
 if s.status='scheduled' and s.scheduled_start_at>now()+interval '15 minutes' then raise exception 'COLLAB_EARLY';end if;
 delete from private.shared_room_presence where session_id=sid and expires_at<=now();
 select * into r from private.shared_room_presence where session_id=sid and user_id=p_user;
 if action='room.enter' then
  if conn is null then raise exception 'COLLAB_INVALID';end if;
  if r.user_id is not null and r.connection_id<>conn and coalesce((p_command->>'takeover')::boolean,false)=false then raise exception 'ROOM_CONTROLLED';end if;
  chosen:=r.seat_id;
  if chosen is null then select 'SEAT_0'||i into chosen from generate_series(1,6) i where not exists(select 1 from private.shared_room_presence where session_id=sid and seat_id='SEAT_0'||i) order by i limit 1;end if;
  if chosen is null then raise exception 'ROOM_SEAT_BUSY';end if;
  insert into private.shared_room_presence(session_id,user_id,connection_id,expires_at,seat_id,appearance)
  values(sid,p_user,conn,now()+interval '75 seconds',chosen,p_appearance)
  on conflict(session_id,user_id) do update set connection_id=excluded.connection_id,expires_at=excluded.expires_at,appearance=excluded.appearance;
  insert into private.shared_room_timers(session_id) values(sid) on conflict do nothing;
 elsif action in ('room.heartbeat','room.leave','room.seat','room.activity','room.hand','room.react') then
  if r.user_id is null or conn is null or r.connection_id<>conn then raise exception 'ROOM_CONTROLLED';end if;
  if action='room.heartbeat' then
   update private.shared_room_presence set expires_at=now()+interval '75 seconds' where session_id=sid and user_id=p_user;notify:=false;
  elsif action='room.leave' then delete from private.shared_room_presence where session_id=sid and user_id=p_user;
  elsif action='room.seat' then
   chosen:=p_command->>'seat_id';
   if chosen is null or chosen!~'^SEAT_0[1-6]$' then raise exception 'COLLAB_INVALID';end if;
   if exists(select 1 from private.shared_room_presence where session_id=sid and seat_id=chosen and user_id<>p_user) then raise exception 'ROOM_SEAT_BUSY';end if;
   update private.shared_room_presence set seat_id=chosen where session_id=sid and user_id=p_user;
  elsif action='room.activity' then update private.shared_room_presence set activity=p_command->>'activity' where session_id=sid and user_id=p_user;
  elsif action='room.hand' then update private.shared_room_presence set hand_raised=(p_command->>'raised')::boolean where session_id=sid and user_id=p_user;
  else
   if r.reaction_at>now()-interval '3 seconds' then raise exception 'ROOM_COOLDOWN';end if;
   update private.shared_room_presence set reaction=p_command->>'reaction',reaction_at=now() where session_id=sid and user_id=p_user;
  end if;
 elsif action='room.timer' then
  if s.host_id is distinct from p_user then raise exception 'COLLAB_FORBIDDEN';end if;
  if s.status<>'active' then raise exception 'COLLAB_STATE';end if;
  insert into private.shared_room_timers(session_id) values(sid) on conflict do nothing;
  select * into timer from private.shared_room_timers where session_id=sid;
  if timer.revision<>(p_command->>'revision')::integer then raise exception 'COLLAB_CONFLICT';end if;
  if p_command->>'operation'='pause' then
   update private.shared_room_timers set running=false,remaining_seconds=greatest(0,coalesce(extract(epoch from deadline-now())::integer,remaining_seconds)),deadline=null,revision=revision+1 where session_id=sid;
  elsif p_command->>'operation'='resume' then
   if timer.running or timer.remaining_seconds<=0 then raise exception 'COLLAB_STATE';end if;
   update private.shared_room_timers set running=true,deadline=now()+make_interval(secs=>remaining_seconds),revision=revision+1 where session_id=sid;
  elsif p_command->>'operation' in ('focus','break') then
   update private.shared_room_timers set phase=p_command->>'operation',running=true,
    remaining_seconds=case when p_command->>'operation'='break' then 300 else 1500 end,
    deadline=now()+case when p_command->>'operation'='break' then interval '5 minutes' else interval '25 minutes' end,revision=revision+1 where session_id=sid;
  else raise exception 'COLLAB_INVALID';end if;
 elsif action='room.goal.add' then
  if (select count(*) from private.shared_room_goals where session_id=sid)>=20 then raise exception 'COLLAB_LIMIT';end if;
  insert into private.shared_room_goals(session_id,title,created_by) values(sid,btrim(p_command->>'title'),p_user);
 elsif action='room.goal.toggle' then
  select * into goal from private.shared_room_goals where session_id=sid and id=(p_command->>'goal_id')::uuid;
  if not found then raise exception 'COLLAB_NOT_FOUND';end if;
  if goal.revision<>(p_command->>'revision')::integer then raise exception 'COLLAB_CONFLICT';end if;
  update private.shared_room_goals set done=(p_command->>'done')::boolean,revision=revision+1 where id=goal.id;
 else raise exception 'COLLAB_INVALID';end if;
 if notify then perform private.shared_room_notify(sid);end if;
 result:=jsonb_build_object('session_id',sid);
 -- Heartbeats are ephemeral. Avoid an unbounded receipt log for visual liveness.
 if action<>'room.heartbeat' then insert into private.collaboration_operations(user_id,operation_id,command,result) values(p_user,p_operation,p_command,result);end if;
 return result;
end $$;
revoke all on function public.shared_room_command(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.shared_room_command(uuid,uuid,jsonb,jsonb) to service_role;
