-- Family requests remain inactive until an authorized operator verifies them.
alter table public.consents
  add column if not exists revoked_at timestamptz;

create index if not exists consents_review_queue
  on public.consents (created_at desc)
  where basis = 'parental-guardian' and verified_at is null and revoked_at is null;

create table if not exists public.operator_audit (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.consents(id) on delete cascade,
  action text not null check (action in ('VERIFY_FAMILY', 'REVOKE_FAMILY')),
  method text,
  evidence_reference text,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.operator_audit enable row level security;
revoke all on public.operator_audit from public, anon, authenticated;
grant select, insert on public.operator_audit to service_role;
grant select, update (verified_at, revoked_at) on public.consents to service_role;
grant select on public.student_states to service_role;
grant select on public.account_controls to service_role;
create index if not exists operator_audit_target_time
  on public.operator_audit (target_user_id, created_at desc);

create or replace function public.operator_consent_decision(
  p_operator uuid,
  p_consent uuid,
  p_action text,
  p_method text default null,
  p_reference text default null,
  p_reason text default null
) returns jsonb
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  request_row public.consents%rowtype;
begin
  select * into request_row
  from public.consents where id = p_consent;
  if not found or request_row.basis <> 'parental-guardian' then
    raise exception 'CONSENT_NOT_FOUND';
  end if;
  -- Lock the shared student row first, then the selected request, so decisions
  -- on separate requests cannot deadlock while revoking them together.
  perform 1 from public.student_states s
    where s.user_id = request_row.user_id for update;
  select * into request_row
  from public.consents where id = p_consent for update;
  if not found then
    raise exception 'CONSENT_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.account_controls c
    where c.user_id = request_row.user_id and c.deleting
  ) then
    raise exception 'CONSENT_ACCOUNT_DELETING';
  end if;
  if p_action = 'VERIFY_FAMILY' then
    if request_row.revoked_at is not null then
      raise exception 'CONSENT_REVOKED';
    end if;
    if request_row.verified_at is not null then
      return jsonb_build_object('status', 'already_verified', 'user_id', request_row.user_id);
    end if;
    if exists (
      select 1 from public.consents c
      where c.user_id = request_row.user_id
        and c.policy_version = request_row.policy_version
        and c.basis = 'parental-guardian'
        and c.verified_at is not null
        and c.revoked_at is null
    ) then
      raise exception 'CONSENT_ALREADY_ACTIVE';
    end if;
    if p_method not in ('independent-call', 'in-person', 'video-call') or
       length(trim(coalesce(p_reference, ''))) < 4 then
      raise exception 'CONSENT_EVIDENCE_REQUIRED';
    end if;
    if not exists (
      select 1 from public.student_states s
      where s.user_id = request_row.user_id
        and s.state->'profile'->>'birth_date' is not null
        and date_part('year', age(current_date, (s.state->'profile'->>'birth_date')::date)) between 13 and 17
    ) then
      raise exception 'CONSENT_STUDENT_INELIGIBLE';
    end if;
    update public.consents set verified_at = now() where id = p_consent;
    insert into public.operator_audit
      (operator_user_id, target_user_id, consent_id, action, method, evidence_reference)
    values
      (p_operator, request_row.user_id, p_consent, p_action, p_method, trim(p_reference));
    return jsonb_build_object('status', 'verified', 'user_id', request_row.user_id);
  elsif p_action = 'REVOKE_FAMILY' then
    if not exists (
      select 1 from public.consents c
      where c.user_id = request_row.user_id
        and c.policy_version = request_row.policy_version
        and c.basis = 'parental-guardian'
        and c.revoked_at is null
    ) then
      return jsonb_build_object('status', 'already_revoked', 'user_id', request_row.user_id);
    end if;
    if length(trim(coalesce(p_reason, ''))) < 8 then
      raise exception 'CONSENT_REASON_REQUIRED';
    end if;
    update public.consents set revoked_at = now()
      where user_id = request_row.user_id
        and policy_version = request_row.policy_version
        and basis = 'parental-guardian'
        and revoked_at is null;
    insert into public.operator_audit
      (operator_user_id, target_user_id, consent_id, action, reason)
    values
      (p_operator, request_row.user_id, p_consent, p_action, trim(p_reason));
    return jsonb_build_object('status', 'revoked', 'user_id', request_row.user_id);
  end if;
  raise exception 'CONSENT_ACTION_INVALID';
end;
$$;
revoke all on function public.operator_consent_decision(uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.operator_consent_decision(uuid,uuid,text,text,text,text)
  to service_role;
