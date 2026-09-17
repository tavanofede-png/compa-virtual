BEGIN;
-- Shared aggregates never enter student_states or commit_state projections.
create schema if not exists private;
create table public.study_groups (
 id uuid primary key default gen_random_uuid(), name text not null check (length(btrim(name)) between 1 and 100),
 owner_id uuid references auth.users on delete set null,
 status text not null default 'active' check(status in ('active','archived')),
 revision integer not null default 0, created_at timestamptz not null default now()
);
create table public.study_group_members (
 group_id uuid not null references public.study_groups on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create index study_group_members_user_idx on public.study_group_members(user_id,group_id);
create table public.space_templates (
 id text primary key, name text not null, max_participants integer not null check(max_participants between 2 and 6)
);
insert into public.space_templates values
 ('living','Living colaborativo',6),('study','Sala de estudio',6),('library','Biblioteca moderna',6),
 ('projects','Sala de proyectos',6),('patio','Patio de estudio',6),('terrace','Terraza de aprendizaje',6);
create table public.group_study_sessions (
 id uuid primary key default gen_random_uuid(), group_id uuid references public.study_groups on delete set null,
 host_id uuid references auth.users on delete set null,
 title text not null check(length(btrim(title)) between 1 and 100),
 objective text not null check(length(btrim(objective)) between 1 and 500),
 session_type text not null check(session_type in ('silent','review','project')),
 space_template_id text not null references public.space_templates,
 scheduled_start_at timestamptz not null, timezone text not null,
 planned_duration integer not null check(planned_duration between 15 and 180),
 meeting_url text check(meeting_url ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'),
 status text not null default 'scheduled' check(status in ('scheduled','active','completed','cancelled')),
 revision integer not null default 0, started_at timestamptz, ended_at timestamptz,
 created_at timestamptz not null default now()
);
create index group_study_sessions_group_idx on public.group_study_sessions(group_id);
create index group_study_sessions_host_idx on public.group_study_sessions(host_id);
create table public.group_session_participants (
 session_id uuid not null references public.group_study_sessions on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 joined_at timestamptz not null default now(), primary key(session_id,user_id)
);
create index group_session_participants_user_idx on public.group_session_participants(user_id,session_id);
create table public.shared_space_instances (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.group_study_sessions on delete cascade
);
create table private.collaboration_identities (
 user_id uuid primary key references auth.users on delete cascade,
 contact_code text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
 nickname text not null check(length(nickname) between 1 and 100)
);
create table private.collaboration_invitations (
 id uuid primary key default gen_random_uuid(),
 group_id uuid references public.study_groups on delete cascade,
 session_id uuid references public.group_study_sessions on delete cascade,
 inviter_id uuid not null references auth.users on delete cascade,
 recipient_id uuid not null references auth.users on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 check ((group_id is null) <> (session_id is null)), check(inviter_id <> recipient_id)
);
create index collaboration_invitations_recipient_idx on private.collaboration_invitations(recipient_id,created_at desc);
create index collaboration_invitations_inviter_idx on private.collaboration_invitations(inviter_id,created_at desc);
create index collaboration_invitations_group_idx on private.collaboration_invitations(group_id) where status='pending';
create index collaboration_invitations_session_idx on private.collaboration_invitations(session_id) where status='pending';
create table private.collaboration_operations (
 user_id uuid not null references auth.users on delete cascade, operation_id uuid not null,
 command jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
-- No direct client table access in this first release. All access passes through
-- the authenticated API and the service-only RPCs below. RLS also blocks REST.
do $$ declare t text; begin
 foreach t in array array['study_groups','study_group_members','space_templates','group_study_sessions','group_session_participants','shared_space_instances'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on schema private from public,anon,authenticated;
alter table private.collaboration_identities enable row level security;
alter table private.collaboration_invitations enable row level security;
alter table private.collaboration_operations enable row level security;
grant usage on schema private to service_role;
grant all on private.collaboration_identities,private.collaboration_invitations,private.collaboration_operations to service_role;

create function public.collaboration_identity(p_user uuid,p_nickname text) returns void
language sql set search_path='' as $$
 insert into private.collaboration_identities(user_id,nickname) values(p_user,left(p_nickname,100))
 on conflict(user_id) do update set nickname=excluded.nickname;
$$;

create function private.collaboration_session(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select (to_jsonb(s)-'meeting_url'-'created_at') || jsonb_build_object('participant_count',
  (select count(*) from public.group_session_participants p where p.session_id=s.id))
 from public.group_study_sessions s where s.id=p_id;
$$;

create function public.collaboration_read(p_user uuid,p_session uuid default null) returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb; begin
 if p_session is not null then
  if not exists(select 1 from public.group_session_participants where session_id=p_session and user_id=p_user)
  then raise exception 'COLLAB_NOT_FOUND'; end if;
  select jsonb_build_object('session',private.collaboration_session(s.id),'instance_id',i.id,
   'meeting_url',s.meeting_url,'server_time',now(),'participants',
   (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'nickname',c.nickname,
    'role',case when p.user_id=s.host_id then 'host' else 'participant' end) order by p.joined_at,p.user_id),'[]')
    from public.group_session_participants p join private.collaboration_identities c using(user_id) where p.session_id=s.id))
   into result from public.group_study_sessions s join public.shared_space_instances i on i.session_id=s.id where s.id=p_session;
  return result;
 end if;
 return jsonb_build_object('enabled',true,'user_id',p_user,'server_time',now(),
  'contact_code',(select contact_code from private.collaboration_identities where user_id=p_user),
  'groups',(select coalesce(jsonb_agg(to_jsonb(g) || jsonb_build_object('members',
    (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'nickname',c.nickname,
      'role',case when m.user_id=g.owner_id then 'owner' else 'member' end) order by m.joined_at,m.user_id),'[]')
     from public.study_group_members m join private.collaboration_identities c using(user_id) where m.group_id=g.id)) order by g.created_at desc),'[]')
    from public.study_groups g where exists(select 1 from public.study_group_members m where m.group_id=g.id and m.user_id=p_user)),
  'sessions',(select coalesce(jsonb_agg(private.collaboration_session(s.id) order by s.scheduled_start_at desc),'[]')
    from public.group_study_sessions s where exists(select 1 from public.group_session_participants p where p.session_id=s.id and p.user_id=p_user)),
  'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'scope',case when i.group_id is null then 'session' else 'group' end,
    'title',coalesce(g.name,s.title),'inviter',a.nickname,'recipient',b.nickname,
    'direction',case when i.recipient_id=p_user then 'received' else 'sent' end,
    'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
    'expires_at',i.expires_at,'created_at',i.created_at) order by i.created_at desc),'[]')
    from private.collaboration_invitations i
    join private.collaboration_identities a on a.user_id=i.inviter_id join private.collaboration_identities b on b.user_id=i.recipient_id
    left join public.study_groups g on g.id=i.group_id left join public.group_study_sessions s on s.id=i.session_id
    where (i.recipient_id=p_user or i.inviter_id=p_user) and i.created_at>now()-interval '30 days'));
end $$;

create function public.collaboration_command(p_user uuid,p_operation uuid,p_command jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare
 action text:=p_command->>'action'; target uuid; peer uuid; iid uuid;
 g public.study_groups; s public.group_study_sessions; inv private.collaboration_invitations;
 op private.collaboration_operations; result jsonb; used integer; cap integer; rev integer;
begin
 if p_operation is null or not exists(select 1 from private.collaboration_identities where user_id=p_user)
 then raise exception 'COLLAB_FORBIDDEN'; end if;
 -- Account first, then group, then session, then invitation. Serializes retries
 -- and capacity reservations without trusting a client-side participant count.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,718));
 select * into op from private.collaboration_operations where user_id=p_user and operation_id=p_operation;
 if found then
  if op.command<>p_command then raise exception 'COLLAB_CONFLICT'; end if;
  return op.result;
 end if;
 if action='group.create' then
  if (select count(*) from public.study_groups where owner_id=p_user and status='active')>=20 then raise exception 'COLLAB_LIMIT'; end if;
  insert into public.study_groups(name,owner_id) values(btrim(p_command->>'name'),p_user) returning id into target;
  insert into public.study_group_members values(target,p_user,now());
  result:=jsonb_build_object('group_id',target);
 elsif action='session.create' then
  target:=(p_command->>'group_id')::uuid;
  if target is not null then
   select * into g from public.study_groups where id=target for update;
   if not found or g.status<>'active' or not exists(select 1 from public.study_group_members where group_id=target and user_id=p_user)
   then raise exception 'COLLAB_NOT_FOUND'; end if;
  end if;
  if (select count(*) from public.group_study_sessions where host_id=p_user and status in ('scheduled','active'))>=30 then raise exception 'COLLAB_LIMIT'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_command->>'timezone') then raise exception 'COLLAB_INVALID'; end if;
  if (p_command->>'scheduled_start_at')::timestamptz < now()-interval '5 minutes' or
     (p_command->>'scheduled_start_at')::timestamptz > now()+interval '1 year' then raise exception 'COLLAB_DATE'; end if;
  insert into public.group_study_sessions(group_id,host_id,title,objective,session_type,space_template_id,scheduled_start_at,timezone,planned_duration,meeting_url)
   values(target,p_user,btrim(p_command->>'title'),btrim(p_command->>'objective'),p_command->>'session_type',p_command->>'space_template_id',
    (p_command->>'scheduled_start_at')::timestamptz,p_command->>'timezone',(p_command->>'planned_duration')::integer,p_command->>'meeting_url') returning id into target;
  insert into public.group_session_participants values(target,p_user,now());
  insert into public.shared_space_instances(session_id) values(target);
  result:=jsonb_build_object('session_id',target);
 elsif action like 'group.%' then
  target:=(p_command->>'group_id')::uuid; peer:=(p_command->>'user_id')::uuid;
  select * into g from public.study_groups where id=target for update;
  if not found or not exists(select 1 from public.study_group_members where group_id=target and user_id=p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
  if action<>'group.leave' and g.owner_id is distinct from p_user then raise exception 'COLLAB_FORBIDDEN'; end if;
  if g.revision<>(p_command->>'revision')::integer then raise exception 'COLLAB_CONFLICT'; end if;
  if g.status<>'active' and action<>'group.leave' then raise exception 'COLLAB_STATE'; end if;
  if action='group.leave' then
   if g.owner_id=p_user then raise exception 'COLLAB_HOST'; end if;
   if exists(select 1 from public.group_study_sessions where group_id=target and host_id=p_user and status in ('scheduled','active')) then raise exception 'COLLAB_HOST'; end if;
   perform 1 from public.group_study_sessions where group_id=target order by id for update;
   delete from public.study_group_members where group_id=target and user_id=p_user;
   delete from public.group_session_participants where user_id=p_user and session_id in(select id from public.group_study_sessions where group_id=target);
   update public.group_study_sessions set revision=revision+1 where group_id=target;
   update private.collaboration_invitations set status='revoked' where recipient_id=p_user and status='pending'
    and (group_id=target or session_id in(select id from public.group_study_sessions where group_id=target));
  elsif action='group.archive' then
   if exists(select 1 from public.group_study_sessions where group_id=target and status in ('scheduled','active')) then raise exception 'COLLAB_OPEN_SESSIONS'; end if;
   update public.study_groups set status='archived' where id=target;
   update private.collaboration_invitations set status='revoked' where group_id=target and status='pending';
  elsif action in ('group.remove','group.transfer') then
   if peer=p_user or not exists(select 1 from public.study_group_members where group_id=target and user_id=peer) then raise exception 'COLLAB_INVALID'; end if;
   if action='group.transfer' then update public.study_groups set owner_id=peer where id=target;
   else
    -- An owner cannot silently evict a session host. Transfer that session first.
    if exists(select 1 from public.group_study_sessions where group_id=target and host_id=peer and status in ('scheduled','active')) then raise exception 'COLLAB_HOST'; end if;
    perform 1 from public.group_study_sessions where group_id=target order by id for update;
    delete from public.study_group_members where group_id=target and user_id=peer;
    delete from public.group_session_participants where user_id=peer and session_id in(select id from public.group_study_sessions where group_id=target);
    update public.group_study_sessions set revision=revision+1 where group_id=target;
    update private.collaboration_invitations set status='revoked' where recipient_id=peer and status='pending'
     and (group_id=target or session_id in(select id from public.group_study_sessions where group_id=target));
   end if;
  else raise exception 'COLLAB_INVALID'; end if;
  update public.study_groups set revision=revision+1 where id=target;
  result:=jsonb_build_object('group_id',target);
 elsif action like 'session.%' then
  target:=(p_command->>'session_id')::uuid; peer:=(p_command->>'user_id')::uuid;
  -- Lock parent before child, including standalone sessions whose parent is null.
  perform 1 from public.study_groups where id=(select group_id from public.group_study_sessions where id=target) for update;
  select * into s from public.group_study_sessions where id=target for update;
  if not found or not exists(select 1 from public.group_session_participants where session_id=target and user_id=p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
  if s.revision<>(p_command->>'revision')::integer then raise exception 'COLLAB_CONFLICT'; end if;
  if action='session.leave' then
   if s.host_id=p_user then raise exception 'COLLAB_HOST'; end if;
   delete from public.group_session_participants where session_id=target and user_id=p_user;
  else
   if s.host_id is distinct from p_user then raise exception 'COLLAB_FORBIDDEN'; end if;
   if action in ('session.remove','session.transfer') then
    if peer=p_user or not exists(select 1 from public.group_session_participants where session_id=target and user_id=peer) then raise exception 'COLLAB_INVALID'; end if;
    if action='session.transfer' then update public.group_study_sessions set host_id=peer where id=target;
    else delete from public.group_session_participants where session_id=target and user_id=peer; end if;
   elsif action='session.start' then
    if s.status<>'scheduled' then raise exception 'COLLAB_STATE'; end if;
    if (select count(*) from public.group_session_participants where session_id=target)<2 then raise exception 'COLLAB_TOO_FEW'; end if;
    if s.scheduled_start_at>now()+interval '15 minutes' then raise exception 'COLLAB_EARLY'; end if;
    update public.group_study_sessions set status='active',started_at=now() where id=target;
   elsif action='session.complete' then
    if s.status<>'active' then raise exception 'COLLAB_STATE'; end if;
    update public.group_study_sessions set status='completed',ended_at=now() where id=target;
   elsif action='session.cancel' then
    if s.status not in ('scheduled','active') then raise exception 'COLLAB_STATE'; end if;
    update public.group_study_sessions set status='cancelled',ended_at=now() where id=target;
   elsif action='session.update' then
    if s.status<>'scheduled' then raise exception 'COLLAB_STATE'; end if;
    if not exists(select 1 from pg_timezone_names where name=p_command->>'timezone') then raise exception 'COLLAB_INVALID'; end if;
    if (p_command->>'scheduled_start_at')::timestamptz<now()-interval '5 minutes' or (p_command->>'scheduled_start_at')::timestamptz>now()+interval '1 year' then raise exception 'COLLAB_DATE'; end if;
    update public.group_study_sessions set title=btrim(p_command->>'title'),objective=btrim(p_command->>'objective'),
     session_type=p_command->>'session_type',space_template_id=p_command->>'space_template_id',
     scheduled_start_at=(p_command->>'scheduled_start_at')::timestamptz,timezone=p_command->>'timezone',
     planned_duration=(p_command->>'planned_duration')::integer,meeting_url=p_command->>'meeting_url' where id=target;
   else raise exception 'COLLAB_INVALID'; end if;
  end if;
  if action in ('session.complete','session.cancel') then
   update private.collaboration_invitations set status='revoked' where session_id=target and status='pending';
  end if;
  update public.group_study_sessions set revision=revision+1 where id=target;
  result:=jsonb_build_object('session_id',target);
 elsif action like 'invite.%' then
  if action='invite.create' then
   target:=(p_command->>'target_id')::uuid;
   if p_command->>'scope'='group' then inv.group_id:=target;
   elsif p_command->>'scope'='session' then inv.session_id:=target;
   else raise exception 'COLLAB_INVALID'; end if;
  else
   select * into inv from private.collaboration_invitations where id=(p_command->>'invite_id')::uuid;
   if not found or (inv.recipient_id<>p_user and inv.inviter_id<>p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
  end if;
  if inv.group_id is not null then
   select * into g from public.study_groups where id=inv.group_id for update;
   if not found or g.status<>'active' then raise exception 'COLLAB_NOT_FOUND'; end if;
   cap:=30; select count(*) into used from public.study_group_members where group_id=g.id;
   used:=used+(select count(*) from private.collaboration_invitations where group_id=g.id and status='pending' and expires_at>now());
  else
   perform 1 from public.study_groups where id=(select group_id from public.group_study_sessions where id=inv.session_id) for update;
   select * into s from public.group_study_sessions where id=inv.session_id for update;
   if not found or s.status not in ('scheduled','active') then raise exception 'COLLAB_NOT_FOUND'; end if;
   select max_participants into cap from public.space_templates where id=s.space_template_id;
   select count(*) into used from public.group_session_participants where session_id=s.id;
   used:=used+(select count(*) from private.collaboration_invitations where session_id=s.id and status='pending' and expires_at>now());
  end if;
  if action='invite.create' then
   if (inv.group_id is not null and g.owner_id is distinct from p_user) or (inv.session_id is not null and s.host_id is distinct from p_user) then raise exception 'COLLAB_FORBIDDEN'; end if;
   if (select count(*) from private.collaboration_invitations where inviter_id=p_user and created_at>now()-interval '1 hour')>=10 or
      (select count(*) from private.collaboration_invitations where inviter_id=p_user and created_at>now()-interval '1 day')>=30 then raise exception 'COLLAB_LIMIT'; end if;
   select user_id into peer from private.collaboration_identities where contact_code=p_command->>'contact_code';
   if peer is null or peer=p_user then raise exception 'COLLAB_RECIPIENT'; end if;
   if inv.session_id is not null and s.group_id is not null and not exists(select 1 from public.study_group_members where group_id=s.group_id and user_id=peer) then raise exception 'COLLAB_GROUP_MEMBER'; end if;
   if exists(select 1 from public.study_group_members where group_id=inv.group_id and user_id=peer) or
      exists(select 1 from public.group_session_participants where session_id=inv.session_id and user_id=peer) or
      exists(select 1 from private.collaboration_invitations where recipient_id=peer and (group_id=inv.group_id or session_id=inv.session_id) and status='pending' and expires_at>now()) then raise exception 'COLLAB_DUPLICATE'; end if;
   if used>=cap then raise exception 'COLLAB_FULL'; end if;
   insert into private.collaboration_invitations(group_id,session_id,inviter_id,recipient_id) values(inv.group_id,inv.session_id,p_user,peer) returning id into iid;
  else
   select * into inv from private.collaboration_invitations where id=inv.id for update;
   if inv.status<>'pending' or inv.expires_at<=now() then raise exception 'COLLAB_INVITE_CLOSED'; end if;
   iid:=inv.id;
   if action='invite.revoke' then
    if inv.inviter_id<>p_user and coalesce(g.owner_id,s.host_id) is distinct from p_user then raise exception 'COLLAB_FORBIDDEN'; end if;
    update private.collaboration_invitations set status='revoked' where id=iid;
   elsif action='invite.respond' then
    if inv.recipient_id<>p_user then raise exception 'COLLAB_NOT_FOUND'; end if;
    if (p_command->>'accept')::boolean then
     if used>cap then raise exception 'COLLAB_FULL'; end if;
     if inv.group_id is not null then insert into public.study_group_members values(inv.group_id,p_user,now());
     else
      if s.group_id is not null and not exists(select 1 from public.study_group_members where group_id=s.group_id and user_id=p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
      insert into public.group_session_participants values(inv.session_id,p_user,now());
     end if;
     update private.collaboration_invitations set status='accepted' where id=iid;
    else update private.collaboration_invitations set status='declined' where id=iid; end if;
   else raise exception 'COLLAB_INVALID'; end if;
  end if;
  if inv.group_id is not null then update public.study_groups set revision=revision+1 where id=inv.group_id;
  else update public.group_study_sessions set revision=revision+1 where id=inv.session_id; end if;
  result:=jsonb_build_object('invite_id',iid);
 else raise exception 'COLLAB_INVALID'; end if;
 insert into private.collaboration_operations(user_id,operation_id,command,result) values(p_user,p_operation,p_command,result);
 return result;
end $$;

-- Preserve peers' history when an account disappears. Close the owned aggregate;
-- membership, contact code and invitations then cascade with the deleted user.
create function private.close_deleted_collaborator() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.study_groups set status='archived',revision=revision+1 where owner_id=old.id;
 update public.group_study_sessions set status='cancelled',ended_at=now(),revision=revision+1
  where status in ('scheduled','active') and (host_id=old.id or group_id in(select id from public.study_groups where owner_id=old.id));
 update private.collaboration_invitations set status='revoked' where status='pending' and
  (group_id in(select id from public.study_groups where owner_id=old.id) or session_id in(select id from public.group_study_sessions where status='cancelled'));
 return old;
end $$;
create trigger close_deleted_collaborator before delete on auth.users for each row execute function private.close_deleted_collaborator();
revoke all on function private.close_deleted_collaborator() from public,anon,authenticated;
revoke all on function public.collaboration_identity(uuid,text),private.collaboration_session(uuid),public.collaboration_read(uuid,uuid),public.collaboration_command(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.collaboration_identity(uuid,text),private.collaboration_session(uuid),public.collaboration_read(uuid,uuid),public.collaboration_command(uuid,uuid,jsonb) to service_role;

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

COMMIT;
