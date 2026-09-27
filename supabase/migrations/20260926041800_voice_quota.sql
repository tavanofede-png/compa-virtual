-- No audio or transcript is stored here. Free allocation is a shared account pool,
-- explicitly verified by an MFA operator, with a short verification window.
create table public.voice_quota_pools (
  account_id text primary key check(account_id ~ '^[a-f0-9]{32}$'),
  day date not null,
  remaining_neurons integer not null check(remaining_neurons between 0 and 8000),
  free_plan_verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null,
  valid_until timestamptz not null
);
create table public.voice_requests (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  day date not null,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  seconds integer not null check(seconds between 1 and 25),
  reserved_neurons integer not null,
  status text not null default 'RESERVED' check(status in ('RESERVED','DONE','FAILED')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index voice_requests_user_day on public.voice_requests(user_id,day,created_at);
create index voice_requests_retention on public.voice_requests(created_at);
create table public.voice_budget_audit (
  operation_id uuid primary key,
  operator_id uuid references auth.users(id) on delete set null,
  account_id text not null,
  observed_remaining integer not null,
  reason text not null check(length(reason) between 10 and 500),
  created_at timestamptz not null default now()
);
alter table public.voice_quota_pools enable row level security;
alter table public.voice_requests enable row level security;
alter table public.voice_budget_audit enable row level security;
revoke all on public.voice_quota_pools,public.voice_requests,public.voice_budget_audit from public,anon,authenticated;
grant all on public.voice_quota_pools,public.voice_requests,public.voice_budget_audit to service_role;

create function public.voice_verify_budget(p_operator uuid,p_account text,p_remaining integer,p_reason text,p_operation uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare utc_day date:=(now() at time zone 'UTC')::date;
begin
  if p_remaining not between 0 and 10000 or length(trim(p_reason)) not between 10 and 500 then raise exception 'VOICE_BUDGET_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('voice:'||p_account,0));
  if exists(select 1 from public.voice_budget_audit where operation_id=p_operation) then
    if not exists(select 1 from public.voice_budget_audit where operation_id=p_operation and operator_id=p_operator and account_id=p_account and observed_remaining=p_remaining and reason=trim(p_reason)) then raise exception 'VOICE_OPERATION_CONFLICT';end if;
    return;
  end if;
  insert into public.voice_quota_pools(account_id,day,remaining_neurons,free_plan_verified,verified_by,verified_at,valid_until)
    values(p_account,utc_day,floor(p_remaining*0.8),true,p_operator,now(),now()+interval '5 minutes')
    on conflict(account_id) do update set
      remaining_neurons=case when voice_quota_pools.day=utc_day then least(voice_quota_pools.remaining_neurons,excluded.remaining_neurons) else excluded.remaining_neurons end,
      day=utc_day,free_plan_verified=true,verified_by=p_operator,verified_at=now(),valid_until=now()+interval '5 minutes';
  insert into public.voice_budget_audit(operation_id,operator_id,account_id,observed_remaining,reason)
    values(p_operation,p_operator,p_account,p_remaining,trim(p_reason));
end $$;

create function public.voice_reserve(p_user uuid,p_account text,p_operation uuid,p_fingerprint text,p_seconds integer,p_student_limit integer default 600)
returns text language plpgsql security invoker set search_path='' as $$
declare pool public.voice_quota_pools%rowtype; previous public.voice_requests%rowtype;
  utc_day date:=(now() at time zone 'UTC')::date; state jsonb; birth date; used integer;
  charge integer:=ceil(p_seconds*46.63/60*1.25+2);
begin
  if p_seconds not between 1 and 25 or p_student_limit not between 1 and 600 then raise exception 'VOICE_REQUEST_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('voice:'||p_account,0));
  select * into previous from public.voice_requests where operation_id=p_operation;
  if found then
    if previous.user_id<>p_user or previous.account_id<>p_account or previous.fingerprint<>p_fingerprint then raise exception 'VOICE_OPERATION_CONFLICT';end if;
    return 'ALREADY_USED';
  end if;
  select s.state into state from public.student_states s where s.user_id=p_user for share;
  if state->'profile' is null or state->'profile'='null'::jsonb then return 'FORBIDDEN';end if;
  birth:=(state->'profile'->>'birth_date')::date;
  if birth is null or birth>current_date-interval '13 years' or
    (birth>current_date-interval '18 years' and not public.family_capability_allowed(p_user,'kusiy-beta-nov-2026','ai')) or
    exists(select 1 from public.account_controls where user_id=p_user and deleting) then return 'FORBIDDEN';end if;
  select * into pool from public.voice_quota_pools where account_id=p_account for update;
  if not found or pool.day<>utc_day or not pool.free_plan_verified or pool.valid_until<=now() then return 'BUDGET_UNVERIFIED';end if;
  select coalesce(sum(seconds),0) into used from public.voice_requests where user_id=p_user and day=utc_day;
  if used+p_seconds>p_student_limit then return 'STUDENT_LIMIT';end if;
  if exists(select 1 from public.voice_requests where user_id=p_user and status='RESERVED' and created_at>now()-interval '2 minutes') then return 'BUSY';end if;
  if pool.remaining_neurons<charge then return 'GLOBAL_LIMIT';end if;
  insert into public.voice_requests(operation_id,user_id,account_id,day,fingerprint,seconds,reserved_neurons)
    values(p_operation,p_user,p_account,utc_day,p_fingerprint,p_seconds,charge);
  update public.voice_quota_pools set remaining_neurons=remaining_neurons-charge where account_id=p_account;
  -- Ambiguous/time-out requests keep their reservation: never refund a call that may have reached Cloudflare.
  delete from public.voice_requests where created_at<now()-interval '30 days';
  return 'RESERVED';
end $$;

revoke all on function public.voice_verify_budget(uuid,text,integer,text,uuid),public.voice_reserve(uuid,text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.voice_verify_budget(uuid,text,integer,text,uuid),public.voice_reserve(uuid,text,uuid,text,integer,integer) to service_role;

create function public.purge_voice_history() returns void language sql security invoker set search_path='' as $$
  delete from public.voice_requests where created_at<now()-interval '30 days';
  delete from public.voice_budget_audit where created_at<now()-interval '90 days';
$$;
revoke all on function public.purge_voice_history() from public,anon,authenticated;
grant execute on function public.purge_voice_history() to service_role;
