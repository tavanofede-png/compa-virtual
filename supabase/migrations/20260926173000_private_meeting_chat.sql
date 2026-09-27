-- Meeting-only chat. Clients never read these tables directly: every read and
-- mutation rechecks session membership through service-role RPCs.
create table private.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.group_study_sessions on delete cascade,
  author_id uuid references auth.users on delete set null,
  operation_id uuid not null,
  body text not null check(char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check(status in ('visible','held','hidden')),
  created_at timestamptz not null default now(),
  unique(author_id,operation_id)
);
create index group_chat_messages_page on private.group_chat_messages(session_id,created_at desc,id desc);
create index group_chat_messages_author_rate on private.group_chat_messages(author_id,created_at desc);

create table private.group_chat_blocks (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);

create table private.group_chat_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.group_study_sessions on delete cascade,
  message_id uuid references private.group_chat_messages on delete set null,
  reporter_id uuid references auth.users on delete set null,
  target_author_id uuid references auth.users on delete set null,
  category text not null check(category in ('harassment','personal-data','sexual','violence','other','automatic-review')),
  detail text check(char_length(detail) <= 500),
  evidence text not null,
  status text not null default 'open' check(status in ('open','resolved')),
  decision text check(decision in ('approve','hide','dismiss')),
  decision_reason text,
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(reporter_id,message_id)
);
create index group_chat_reports_queue on private.group_chat_reports(status,created_at,id);

do $$ declare t text; begin
  foreach t in array array['group_chat_messages','group_chat_blocks','group_chat_reports'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated',t);
    execute format('grant all on private.%I to service_role',t);
  end loop;
end $$;

create table private.social_chat_control (
  singleton boolean primary key default true check(singleton),
  writable boolean not null default false,
  updated_by uuid references auth.users on delete set null,
  reason text not null default 'Pendiente de aprobación operativa',
  updated_at timestamptz not null default now()
);
insert into private.social_chat_control(singleton) values(true);
create table private.social_chat_control_audit (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references auth.users on delete set null,
  writable boolean not null,
  reason text not null check(char_length(btrim(reason)) between 8 and 300),
  created_at timestamptz not null default now()
);
alter table private.social_chat_control enable row level security;
alter table private.social_chat_control_audit enable row level security;
revoke all on private.social_chat_control,private.social_chat_control_audit from public,anon,authenticated;
grant all on private.social_chat_control,private.social_chat_control_audit to service_role;

create function public.social_chat_writable() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select writable from private.social_chat_control where singleton),false);
$$;
revoke all on function public.social_chat_writable() from public,anon,authenticated;
grant execute on function public.social_chat_writable() to service_role;

create function public.operator_chat_control() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('writable',c.writable,'reason',c.reason,'updated_at',c.updated_at,
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id desc)
      from (select id,operator_id,writable,reason,created_at from private.social_chat_control_audit
        order by created_at desc,id desc limit 20) a),'[]'::jsonb))
  from private.social_chat_control c where c.singleton;
$$;
revoke all on function public.operator_chat_control() from public,anon,authenticated;
grant execute on function public.operator_chat_control() to service_role;

create function public.operator_chat_set_writable(p_operator uuid,p_writable boolean,p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare current_state boolean;
begin
  if p_operator is null or p_writable is null or p_reason is null or
    char_length(btrim(p_reason)) not between 8 and 300 then raise exception 'CHAT_INVALID'; end if;
  select writable into current_state from private.social_chat_control where singleton for update;
  if current_state is distinct from p_writable then
    update private.social_chat_control set writable=p_writable,updated_by=p_operator,
      reason=btrim(p_reason),updated_at=now() where singleton;
    insert into private.social_chat_control_audit(operator_id,writable,reason)
      values(p_operator,p_writable,btrim(p_reason));
  end if;
  return public.operator_chat_control();
end $$;
revoke all on function public.operator_chat_set_writable(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.operator_chat_set_writable(uuid,boolean,text) to service_role;

create function public.collaboration_chat_read(
  p_user uuid,p_session uuid,p_before_time timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql stable set search_path = '' as $$
declare items jsonb;
begin
  if not exists(select 1 from public.group_session_participants
    where session_id=p_session and user_id=p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb)
    into items from (
      select m.id,m.author_id,coalesce(i.nickname,'Cuenta eliminada') author_name,
        m.body,m.status,m.created_at
      from private.group_chat_messages m
      left join private.collaboration_identities i on i.user_id=m.author_id
      where m.session_id=p_session
        and (m.status='visible' or (m.status='held' and m.author_id=p_user))
        and not exists(select 1 from private.group_chat_blocks b
          where b.blocker_id=p_user and b.blocked_id=m.author_id)
        and (p_before_time is null or (m.created_at,m.id)<(p_before_time,p_before_id))
      order by m.created_at desc,m.id desc limit 30
    ) page;
  return jsonb_build_object('messages',items,
    'next_cursor',case when jsonb_array_length(items)=30 then jsonb_build_object(
      'created_at',items->29->>'created_at','id',items->29->>'id') else null end);
end $$;
revoke all on function public.collaboration_chat_read(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.collaboration_chat_read(uuid,uuid,timestamptz,uuid) to service_role;

create function public.collaboration_chat_send(
  p_user uuid,p_operation uuid,p_session uuid,p_body text
) returns jsonb language plpgsql set search_path = '' as $$
declare s public.group_study_sessions; existing private.group_chat_messages; mid uuid; state text; allowed boolean;
begin
  if p_operation is null or p_body is null or char_length(btrim(p_body)) not between 1 and 1000
    then raise exception 'CHAT_INVALID'; end if;
  if p_body ~* '(https?://|www[.]|[[:alnum:]_.%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,})'
    then raise exception 'CHAT_LINK'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,719));
  select * into s from public.group_study_sessions where id=p_session for share;
  if not found or not exists(select 1 from public.group_session_participants
    where session_id=p_session and user_id=p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
  select * into existing from private.group_chat_messages
    where author_id=p_user and operation_id=p_operation;
  if found then
    if existing.session_id<>p_session or existing.body<>btrim(p_body)
      then raise exception 'COLLAB_CONFLICT'; end if;
    return jsonb_build_object('message_id',existing.id,'status',existing.status);
  end if;
  select writable into allowed from private.social_chat_control where singleton for share;
  if allowed is distinct from true then raise exception 'CHAT_READ_ONLY'; end if;
  if s.status not in ('scheduled','active') then raise exception 'COLLAB_STATE'; end if;
  if s.status='scheduled' and s.scheduled_start_at>now()+interval '15 minutes'
    then raise exception 'COLLAB_EARLY'; end if;
  if (select count(*) from private.group_chat_messages
    where author_id=p_user and created_at>now()-interval '1 minute')>=6
    or (select count(*) from private.group_chat_messages
    where author_id=p_user and created_at>now()-interval '1 hour')>=100
    then raise exception 'CHAT_RATE'; end if;
  state:=case when p_body ~* '(suicid|autoles|matar|amenaz|violenc|desnud|porn|sext|abuso)'
    then 'held' else 'visible' end;
  insert into private.group_chat_messages(session_id,author_id,operation_id,body,status)
    values(p_session,p_user,p_operation,btrim(p_body),state) returning id into mid;
  if state='held' then
    insert into private.group_chat_reports(session_id,message_id,target_author_id,category,evidence)
      values(p_session,mid,p_user,'automatic-review',btrim(p_body));
  end if;
  perform private.shared_room_notify(p_session);
  return jsonb_build_object('message_id',mid,'status',state);
end $$;
revoke all on function public.collaboration_chat_send(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.collaboration_chat_send(uuid,uuid,uuid,text) to service_role;

create function public.collaboration_chat_report(
  p_user uuid,p_session uuid,p_message uuid,p_category text,p_detail text default null
) returns jsonb language plpgsql set search_path = '' as $$
declare m private.group_chat_messages; rid uuid;
begin
  if p_category not in ('harassment','personal-data','sexual','violence','other')
    or char_length(coalesce(p_detail,''))>500 then raise exception 'CHAT_INVALID'; end if;
  if not exists(select 1 from public.group_session_participants
    where session_id=p_session and user_id=p_user) then raise exception 'COLLAB_NOT_FOUND'; end if;
  select * into m from private.group_chat_messages where id=p_message and session_id=p_session;
  if not found or m.author_id=p_user then raise exception 'COLLAB_NOT_FOUND'; end if;
  insert into private.group_chat_reports(session_id,message_id,reporter_id,target_author_id,category,detail,evidence)
    values(p_session,p_message,p_user,m.author_id,p_category,nullif(btrim(p_detail),''),m.body)
    on conflict(reporter_id,message_id) do nothing returning id into rid;
  if rid is null then select id into rid from private.group_chat_reports
    where reporter_id=p_user and message_id=p_message; end if;
  return jsonb_build_object('report_id',rid);
end $$;
revoke all on function public.collaboration_chat_report(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.collaboration_chat_report(uuid,uuid,uuid,text,text) to service_role;

create function public.collaboration_chat_block(p_user uuid,p_target uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare sid uuid;
begin
  if p_user=p_target or not exists(
    select 1 from public.group_session_participants a
      join public.group_session_participants b on b.session_id=a.session_id
      where a.user_id=p_user and b.user_id=p_target
    union select 1 from public.study_group_members a
      join public.study_group_members b on b.group_id=a.group_id
      where a.user_id=p_user and b.user_id=p_target
  ) then raise exception 'COLLAB_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(p_user,p_target)::text,718));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_user,p_target)::text,718));
  insert into private.group_chat_blocks(blocker_id,blocked_id) values(p_user,p_target)
    on conflict do nothing;
  update private.collaboration_invitations set status='revoked'
    where status='pending' and ((inviter_id=p_user and recipient_id=p_target)
      or (inviter_id=p_target and recipient_id=p_user));
  for sid in select r.session_id from private.shared_room_presence r
    where r.user_id=p_user and exists(select 1 from private.shared_room_presence peer
      where peer.session_id=r.session_id and peer.user_id=p_target and peer.expires_at>now())
    order by r.session_id loop
    delete from private.shared_room_presence where session_id=sid and user_id=p_user;
    perform private.shared_room_notify(sid);
  end loop;
  return jsonb_build_object('blocked',true);
end $$;
revoke all on function public.collaboration_chat_block(uuid,uuid) from public,anon,authenticated;
grant execute on function public.collaboration_chat_block(uuid,uuid) to service_role;

-- A block also prevents new invitations and simultaneous room presence.
alter function public.collaboration_command(uuid,uuid,jsonb) rename to collaboration_command_pre_chat;
create function public.collaboration_command(p_user uuid,p_operation uuid,p_command jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare peer uuid;
begin
  if p_command->>'action'='invite.create' then
    select user_id into peer from private.collaboration_identities
      where contact_code=p_command->>'contact_code';
  elsif p_command->>'action'='invite.respond' and p_command->>'accept'='true' then
    select inviter_id into peer from private.collaboration_invitations
      where id=(p_command->>'invite_id')::uuid and recipient_id=p_user;
  end if;
  if peer is not null then
    perform pg_advisory_xact_lock(hashtextextended(least(p_user,peer)::text,718));
    perform pg_advisory_xact_lock(hashtextextended(greatest(p_user,peer)::text,718));
  end if;
  if peer is not null and exists(select 1 from private.group_chat_blocks
    where (blocker_id=p_user and blocked_id=peer)
      or (blocker_id=peer and blocked_id=p_user)) then raise exception 'CHAT_BLOCKED_PEER'; end if;
  return public.collaboration_command_pre_chat(p_user,p_operation,p_command);
end $$;
revoke all on function public.collaboration_command(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.collaboration_command(uuid,uuid,jsonb) to service_role;

alter function public.collaboration_join_group_session(uuid,uuid,jsonb)
  rename to collaboration_join_group_session_pre_chat;
create function public.collaboration_join_group_session(
  p_user uuid,p_operation uuid,p_command jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare sid uuid := (p_command->>'session_id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,718));
  if exists(select 1 from public.group_session_participants participant
    join private.group_chat_blocks b on
      (b.blocker_id=p_user and b.blocked_id=participant.user_id)
      or (b.blocked_id=p_user and b.blocker_id=participant.user_id)
    where participant.session_id=sid) then raise exception 'CHAT_BLOCKED_PEER'; end if;
  return public.collaboration_join_group_session_pre_chat(p_user,p_operation,p_command);
end $$;
revoke all on function public.collaboration_join_group_session(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.collaboration_join_group_session(uuid,uuid,jsonb) to service_role;

alter function public.shared_room_command(uuid,uuid,jsonb,jsonb) rename to shared_room_command_pre_chat;
create function public.shared_room_command(
  p_user uuid,p_operation uuid,p_command jsonb,p_appearance jsonb default '{}'
) returns jsonb language plpgsql set search_path = '' as $$
declare sid uuid := (p_command->>'session_id')::uuid;
begin
  if p_command->>'action'='room.enter' then
    perform pg_advisory_xact_lock(hashtextextended(p_user::text,718));
    if exists(select 1 from private.shared_room_presence r
      join private.group_chat_blocks b on
        (b.blocker_id=p_user and b.blocked_id=r.user_id)
        or (b.blocked_id=p_user and b.blocker_id=r.user_id)
      where r.session_id=sid and r.expires_at>now())
      then raise exception 'CHAT_BLOCKED_PEER'; end if;
  end if;
  return public.shared_room_command_pre_chat(p_user,p_operation,p_command,p_appearance);
end $$;
revoke all on function public.shared_room_command(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.shared_room_command(uuid,uuid,jsonb,jsonb) to service_role;

create function public.operator_chat_reports() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at,r.id),'[]'::jsonb)
  from (select id,session_id,message_id,reporter_id,target_author_id,category,detail,
    evidence,status,created_at from private.group_chat_reports where status='open'
    order by created_at,id limit 100) r;
$$;
revoke all on function public.operator_chat_reports() from public,anon,authenticated;
grant execute on function public.operator_chat_reports() to service_role;

create function public.operator_chat_decide(
  p_operator uuid,p_report uuid,p_action text,p_reason text
) returns jsonb language plpgsql set search_path = '' as $$
declare r private.group_chat_reports;
begin
  if p_action not in ('approve','hide','dismiss') or char_length(btrim(p_reason)) not between 8 and 300
    then raise exception 'CHAT_INVALID'; end if;
  select * into r from private.group_chat_reports where id=p_report for update;
  if not found then raise exception 'COLLAB_NOT_FOUND'; end if;
  if r.status='resolved' then
    if r.decision<>p_action then raise exception 'COLLAB_CONFLICT'; end if;
    return jsonb_build_object('report_id',r.id,'decision',r.decision);
  end if;
  if p_action='approve' then
    update private.group_chat_messages set status='visible' where id=r.message_id and status='held';
  elsif p_action='hide' then
    update private.group_chat_messages set status='hidden' where id=r.message_id;
  end if;
  update private.group_chat_reports set status='resolved',decision=p_action,
    decision_reason=btrim(p_reason),reviewed_by=p_operator,reviewed_at=now() where id=r.id;
  perform private.shared_room_notify(r.session_id);
  return jsonb_build_object('report_id',r.id,'decision',p_action);
end $$;
revoke all on function public.operator_chat_decide(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.operator_chat_decide(uuid,uuid,text,text) to service_role;

create function public.group_chat_export(p_user uuid,p_offset integer default 0)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id)
      from (select id,session_id,body,status,created_at from private.group_chat_messages
        where author_id=p_user order by created_at,id limit 500 offset greatest(0,p_offset)) m),'[]'::jsonb),
    'reports',case when p_offset=0 then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id)
      from (select id,session_id,message_id,category,detail,evidence,status,decision,created_at
        from private.group_chat_reports where reporter_id=p_user order by created_at,id) r),'[]'::jsonb)
      else '[]'::jsonb end);
$$;
revoke all on function public.group_chat_export(uuid,integer) from public,anon,authenticated;
grant execute on function public.group_chat_export(uuid,integer) to service_role;

create function private.remove_deleted_group_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A reporter's evidence may outlive the message only under the report-retention rule.
  delete from private.group_chat_messages where author_id=old.id;
  return old;
end $$;
revoke all on function private.remove_deleted_group_chat() from public,anon,authenticated;
create trigger remove_deleted_group_chat before delete on auth.users
  for each row execute function private.remove_deleted_group_chat();

create function private.cleanup_group_chat() returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from private.group_chat_messages where created_at<now()-interval '30 days';
  get diagnostics removed=row_count;
  delete from private.group_chat_reports
    where status='resolved' and created_at<now()-interval '90 days';
  return removed;
end $$;
revoke all on function private.cleanup_group_chat() from public,anon,authenticated;
grant execute on function private.cleanup_group_chat() to service_role;
do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('compa-private-meeting-chat-retention','0 3 * * *',
      'select private.cleanup_group_chat()');
  end if;
end $$;
