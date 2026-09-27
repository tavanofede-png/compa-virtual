-- Authenticated support is independent of academic and social permissions.
-- The API passes the authenticated user; clients cannot execute these RPCs.
create table private.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  category text not null check(category in ('access','study','materials','rooms','voice','safety','other')),
  subject text not null check(char_length(btrim(subject)) between 4 and 100),
  status text not null default 'open' check(status in ('open','in_progress','waiting_student','resolved')),
  priority text not null default 'normal' check(priority in ('normal','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,operation_id)
);
create index support_tickets_owner_page on private.support_tickets(user_id,updated_at desc,id desc);
create index support_tickets_operator_queue on private.support_tickets(status,priority,updated_at desc,id desc);

create table private.support_ticket_rate_locks (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table private.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references private.support_tickets(id) on delete cascade,
  operation_id uuid not null,
  author_kind text not null check(author_kind in ('student','operator')),
  author_id uuid references auth.users(id) on delete set null,
  body text not null check(char_length(btrim(body)) between 4 and 2000),
  created_at timestamptz not null default now(),
  unique(ticket_id,operation_id)
);
create index support_ticket_messages_page on private.support_ticket_messages(ticket_id,created_at,id);

create table private.support_ticket_audit (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references private.support_tickets(id) on delete cascade,
  operation_id uuid not null,
  operator_id uuid references auth.users(id) on delete set null,
  from_status text not null,
  to_status text not null,
  created_at timestamptz not null default now(),
  unique(ticket_id,operation_id)
);

alter table private.support_tickets enable row level security;
alter table private.support_ticket_rate_locks enable row level security;
alter table private.support_ticket_messages enable row level security;
alter table private.support_ticket_audit enable row level security;
revoke all on private.support_tickets,private.support_ticket_rate_locks,private.support_ticket_messages,private.support_ticket_audit from public,anon,authenticated;
grant all on private.support_tickets,private.support_ticket_rate_locks,private.support_ticket_messages,private.support_ticket_audit to service_role;

create function public.support_create(p_user uuid,p_operation uuid,p_category text,p_subject text,p_body text)
returns jsonb language plpgsql set search_path = '' as $$
declare t private.support_tickets;
begin
  if p_user is null or p_operation is null or p_category is null or
    p_category not in ('access','study','materials','rooms','voice','safety','other') or
    p_subject is null or char_length(btrim(p_subject)) not between 4 and 100 or
    p_body is null or char_length(btrim(p_body)) not between 4 and 2000 then
    raise exception 'SUPPORT_INVALID';
  end if;
  select * into t from private.support_tickets where user_id=p_user and operation_id=p_operation;
  if t.id is not null then return to_jsonb(t); end if;
  -- A private lock serializes this user's creates without requiring UPDATE on auth.users.
  insert into private.support_ticket_rate_locks(user_id) values(p_user) on conflict do nothing;
  perform 1 from private.support_ticket_rate_locks where user_id=p_user for update;
  select * into t from private.support_tickets where user_id=p_user and operation_id=p_operation;
  if t.id is not null then return to_jsonb(t); end if;
  if (select count(*) from private.support_tickets where user_id=p_user
      and created_at >= now() - interval '24 hours') >= 5 then
    raise exception 'SUPPORT_RATE_LIMIT';
  end if;
  insert into private.support_tickets(user_id,operation_id,category,subject,priority)
    values(p_user,p_operation,p_category,btrim(p_subject),
      case when p_category='safety' then 'urgent' else 'normal' end)
    returning * into t;
  insert into private.support_ticket_messages(ticket_id,operation_id,author_kind,author_id,body)
    values(t.id,p_operation,'student',p_user,btrim(p_body));
  return to_jsonb(t);
end;
$$;

create function public.support_reply(p_user uuid,p_ticket uuid,p_operation uuid,p_body text)
returns jsonb language plpgsql set search_path = '' as $$
declare t private.support_tickets; m private.support_ticket_messages;
begin
  if p_user is null or p_ticket is null or p_operation is null or
    p_body is null or char_length(btrim(p_body)) not between 4 and 2000 then
    raise exception 'SUPPORT_INVALID';
  end if;
  select * into t from private.support_tickets where id=p_ticket and user_id=p_user for update;
  if t.id is null then raise exception 'SUPPORT_NOT_FOUND'; end if;
  select * into m from private.support_ticket_messages where ticket_id=p_ticket and operation_id=p_operation;
  if m.id is not null then return to_jsonb(m); end if;
  if (select count(*) from private.support_ticket_messages where author_id=p_user
      and author_kind='student' and created_at >= now() - interval '24 hours') >= 20 then
    raise exception 'SUPPORT_RATE_LIMIT';
  end if;
  insert into private.support_ticket_messages(ticket_id,operation_id,author_kind,author_id,body)
    values(p_ticket,p_operation,'student',p_user,btrim(p_body)) returning * into m;
  update private.support_tickets set status='open',updated_at=now() where id=p_ticket;
  return to_jsonb(m);
end;
$$;

create function public.support_read(p_user uuid,p_before_updated timestamptz default null,p_before_id uuid default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('messages',
    coalesce((select jsonb_agg(to_jsonb(m) - 'author_id' order by m.created_at,m.id)
      from private.support_ticket_messages m where m.ticket_id=t.id),'[]'::jsonb))
    order by t.updated_at desc,t.id desc),'[]'::jsonb)
  from (select id,user_id,category,subject,status,priority,created_at,updated_at
    from private.support_tickets where user_id=p_user
      and (p_before_id is null or updated_at < p_before_updated
        or (updated_at=p_before_updated and id < p_before_id))
    order by updated_at desc,id desc limit 51) t;
$$;

create function public.operator_support_queue(p_status text default null,
  p_before_priority text default null,p_before_updated timestamptz default null,
  p_before_id uuid default null)
returns jsonb language plpgsql stable set search_path = '' as $$
begin
  if p_status is not null and p_status not in ('open','in_progress','waiting_student','resolved') then
    raise exception 'SUPPORT_INVALID';
  end if;
  if (p_before_priority is null or p_before_updated is null or p_before_id is null)
      and not (p_before_priority is null and p_before_updated is null and p_before_id is null) then
    raise exception 'SUPPORT_INVALID';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('messages',
    coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id)
      from private.support_ticket_messages m where m.ticket_id=t.id),'[]'::jsonb))
    order by t.priority desc,t.updated_at desc,t.id desc),'[]'::jsonb)
    from (select id,user_id,category,subject,status,priority,created_at,updated_at
      from private.support_tickets where (p_status is null or status=p_status)
        and (p_before_id is null or priority < p_before_priority
          or (priority=p_before_priority and (updated_at < p_before_updated
            or (updated_at=p_before_updated and id < p_before_id))))
      order by priority desc,updated_at desc,id desc limit 51) t);
end;
$$;

create function public.support_export(p_user uuid,p_offset integer)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('messages',
    coalesce((select jsonb_agg(to_jsonb(m) - 'author_id' order by m.created_at,m.id)
      from private.support_ticket_messages m where m.ticket_id=t.id),'[]'::jsonb))
    order by t.created_at,t.id),'[]'::jsonb)
  from (select id,user_id,category,subject,status,priority,created_at,updated_at
    from private.support_tickets where user_id=p_user
    order by created_at,id limit 500 offset greatest(coalesce(p_offset,0),0)) t;
$$;

create function public.operator_support_update(p_operator uuid,p_ticket uuid,p_status text,
  p_operation uuid,p_response text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare t private.support_tickets; m private.support_ticket_messages; previous_status text;
begin
  if p_operator is null or p_ticket is null or p_operation is null or p_status is null or
    p_status not in ('open','in_progress','waiting_student','resolved') or
    (p_response is not null and char_length(btrim(p_response)) not between 4 and 2000) or
    (p_status in ('waiting_student','resolved') and p_response is null) then
    raise exception 'SUPPORT_INVALID';
  end if;
  select * into t from private.support_tickets where id=p_ticket for update;
  if t.id is null then raise exception 'SUPPORT_NOT_FOUND'; end if;
  previous_status := t.status;
  if exists(select 1 from private.support_ticket_audit
      where ticket_id=p_ticket and operation_id=p_operation) then return to_jsonb(t); end if;
  select * into m from private.support_ticket_messages where ticket_id=p_ticket and operation_id=p_operation;
  if m.id is not null then return to_jsonb(t); end if;
  if p_response is not null then
    insert into private.support_ticket_messages(ticket_id,operation_id,author_kind,author_id,body)
      values(p_ticket,p_operation,'operator',p_operator,btrim(p_response));
  end if;
  update private.support_tickets set status=p_status,updated_at=now() where id=p_ticket returning * into t;
  insert into private.support_ticket_audit(ticket_id,operation_id,operator_id,from_status,to_status)
    values(p_ticket,p_operation,p_operator,previous_status,p_status);
  return to_jsonb(t);
end;
$$;

revoke all on function public.support_create(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.support_reply(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.support_read(uuid,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.operator_support_queue(text,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.support_export(uuid,integer) from public,anon,authenticated;
revoke all on function public.operator_support_update(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.support_create(uuid,uuid,text,text,text) to service_role;
grant execute on function public.support_reply(uuid,uuid,uuid,text) to service_role;
grant execute on function public.support_read(uuid,timestamptz,uuid) to service_role;
grant execute on function public.operator_support_queue(text,text,timestamptz,uuid) to service_role;
grant execute on function public.support_export(uuid,integer) to service_role;
grant execute on function public.operator_support_update(uuid,uuid,text,uuid,text) to service_role;
