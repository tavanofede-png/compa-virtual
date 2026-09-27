-- Independent verification is not acceptance of every purpose. No historical
-- consent is converted into an AI/social grant by this migration.
create table public.capability_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.consents(id) on delete cascade,
  policy_version text not null,
  capability text not null check (capability in ('service','ai','social')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(consent_id, capability)
);
alter table public.capability_grants enable row level security;
revoke all on public.capability_grants from public, anon, authenticated;
grant select on public.capability_grants to authenticated;
create policy own_capability_grants on public.capability_grants for select
  to authenticated using (user_id = (select auth.uid()));
grant select, insert, update on public.capability_grants to service_role;
create index capability_grants_active
  on public.capability_grants(user_id, policy_version, capability)
  where revoked_at is null;

create table public.family_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.consents(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  terms_url text not null check (terms_url like 'https://%'),
  privacy_url text not null check (privacy_url like 'https://%'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  request_window timestamptz not null default now(),
  request_count integer not null default 0
);
alter table public.family_links enable row level security;
revoke all on public.family_links from public, anon, authenticated;
grant select, insert, update on public.family_links to service_role;
create index family_links_user on public.family_links(user_id, created_at desc);

alter table public.operator_audit drop constraint operator_audit_action_check;
alter table public.operator_audit add constraint operator_audit_action_check
  check (action in ('VERIFY_FAMILY','REVOKE_FAMILY','ISSUE_FAMILY_LINK','FAMILY_ACCEPT','FAMILY_REVOKE'));
alter table public.operator_audit
  add column actor_kind text not null default 'operator' check (actor_kind in ('operator','guardian')),
  add column link_id uuid references public.family_links(id) on delete set null,
  add column operation_id uuid,
  add column result jsonb;
create unique index family_decision_operation
  on public.operator_audit(link_id, operation_id) where operation_id is not null;

create function public.family_capability_allowed(p_user uuid, p_policy text, p_capability text)
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.capability_grants g join public.consents c on c.id = g.consent_id
    where g.user_id = p_user and c.user_id = p_user
      and g.policy_version = p_policy and c.policy_version = p_policy
      and g.capability = p_capability and g.revoked_at is null
      and (g.capability = 'service' or exists (
        select 1 from public.capability_grants service_grant
        where service_grant.consent_id = g.consent_id and service_grant.capability = 'service'
          and service_grant.revoked_at is null
      ))
      and c.basis = 'parental-guardian' and c.verified_at is not null and c.revoked_at is null
      and not exists (select 1 from public.account_controls x where x.user_id = p_user and x.deleting)
  );
$$;
revoke all on function public.family_capability_allowed(uuid,text,text) from public, anon, authenticated;
grant execute on function public.family_capability_allowed(uuid,text,text) to service_role;

create function public.revoke_family_related() returns trigger language plpgsql
security invoker set search_path = public, pg_temp as $$
begin
  update public.capability_grants set revoked_at = new.revoked_at
    where consent_id = new.id and revoked_at is null;
  update public.family_links set revoked_at = new.revoked_at
    where consent_id = new.id and revoked_at is null;
  return new;
end;
$$;
revoke all on function public.revoke_family_related() from public, anon, authenticated;
grant execute on function public.revoke_family_related() to service_role;
create trigger consent_revokes_capabilities after update of revoked_at on public.consents
  for each row when (old.revoked_at is null and new.revoked_at is not null)
  execute function public.revoke_family_related();

create function public.operator_family_link(p_operator uuid, p_consent uuid, p_hash text, p_terms text, p_privacy text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.consents%rowtype; l public.family_links%rowtype;
begin
  select * into c from public.consents where id = p_consent;
  if not found then raise exception 'CONSENT_NOT_FOUND'; end if;
  perform 1 from public.student_states where user_id = c.user_id for update;
  select * into c from public.consents where id = p_consent for update;
  if not found or c.basis <> 'parental-guardian' or c.policy_version <> 'kusiy-beta-nov-2026'
    or c.verified_at is null or c.revoked_at is not null then
    raise exception 'FAMILY_NOT_VERIFIED';
  end if;
  if exists(select 1 from public.account_controls where user_id = c.user_id and deleting) then
    raise exception 'CONSENT_ACCOUNT_DELETING';
  end if;
  if exists(select 1 from public.family_links where user_id = c.user_id and created_at > now() - interval '1 minute') then
    raise exception 'FAMILY_LINK_COOLDOWN';
  end if;
  update public.family_links set revoked_at = now() where user_id = c.user_id and revoked_at is null;
  insert into public.family_links(user_id,consent_id,token_hash,created_by,terms_url,privacy_url)
    values(c.user_id,c.id,p_hash,p_operator,p_terms,p_privacy) returning * into l;
  insert into public.operator_audit(operator_user_id,target_user_id,consent_id,action,link_id)
    values(p_operator,c.user_id,c.id,'ISSUE_FAMILY_LINK',l.id);
  return jsonb_build_object('id',l.id,'expires_at',l.expires_at);
end;
$$;
revoke all on function public.operator_family_link(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.operator_family_link(uuid,uuid,text,text,text) to service_role;

create function public.family_access(
  p_hash text, p_action text, p_operation uuid default null,
  p_permissions jsonb default null, p_revoke text[] default null
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  l public.family_links%rowtype; c public.consents%rowtype;
  previous jsonb; previous_action text; permissions jsonb; output jsonb; cap text; enabled boolean;
begin
  select * into l from public.family_links where token_hash = p_hash;
  if not found then raise exception 'FAMILY_LINK_INVALID'; end if;
  perform 1 from public.student_states where user_id = l.user_id for update;
  select * into l from public.family_links where id = l.id for update;
  if not found then raise exception 'FAMILY_LINK_INVALID'; end if;
  if p_operation is not null then
    select result,action into previous,previous_action from public.operator_audit
      where link_id = l.id and operation_id = p_operation and action in ('FAMILY_ACCEPT','FAMILY_REVOKE');
    if found then
      if previous_action <> ('FAMILY_' || p_action) then raise exception 'FAMILY_PERMISSIONS_INVALID'; end if;
      -- Replay the receipt without replaying its effects. Return current grants,
      -- so an old acceptance cannot make the UI appear authorized after revocation.
      return previous || jsonb_build_object('permissions',jsonb_build_object(
        'service',public.family_capability_allowed(l.user_id,previous->>'policy_version','service'),
        'ai',public.family_capability_allowed(l.user_id,previous->>'policy_version','ai'),
        'social',public.family_capability_allowed(l.user_id,previous->>'policy_version','social')));
    end if;
  end if;
  select * into c from public.consents where id = l.consent_id for update;
  if not found or l.expires_at <= now() or l.revoked_at is not null
    or c.verified_at is null or c.revoked_at is not null
    or c.policy_version <> 'kusiy-beta-nov-2026'
    or exists(select 1 from public.account_controls where user_id = l.user_id and deleting) then
    raise exception 'FAMILY_LINK_INVALID';
  end if;
  if l.request_window > now() - interval '1 minute' and l.request_count >= 30 then
    raise exception 'FAMILY_LINK_RATE_LIMIT';
  end if;
  update public.family_links set
    request_count = case when request_window > now() - interval '1 minute' then request_count + 1 else 1 end,
    request_window = case when request_window > now() - interval '1 minute' then request_window else now() end
    where id = l.id;
  if p_action = 'ACCEPT' then
    if p_operation is null or l.accepted_at is not null then raise exception 'FAMILY_LINK_USED'; end if;
    if p_permissions is null or jsonb_typeof(p_permissions) <> 'object' then
      raise exception 'FAMILY_PERMISSIONS_INVALID';
    end if;
    if (select count(*) from jsonb_object_keys(p_permissions)) <> 3
      or jsonb_typeof(p_permissions->'service') is distinct from 'boolean'
      or jsonb_typeof(p_permissions->'ai') is distinct from 'boolean'
      or jsonb_typeof(p_permissions->'social') is distinct from 'boolean'
      or p_permissions->'service' is distinct from 'true'::jsonb then
      raise exception 'FAMILY_PERMISSIONS_INVALID';
    end if;
    foreach cap in array array['service','ai','social'] loop
      enabled := (p_permissions->>cap)::boolean;
      if enabled then
        insert into public.capability_grants(user_id,consent_id,policy_version,capability)
          values(l.user_id,c.id,c.policy_version,cap)
          on conflict (consent_id,capability) do update set granted_at = now(), revoked_at = null;
      else
        update public.capability_grants set revoked_at = now()
          where consent_id = c.id and capability = cap and revoked_at is null;
      end if;
    end loop;
    update public.family_links set accepted_at = now() where id = l.id;
    l.accepted_at := now();
  elsif p_action = 'REVOKE' then
    if p_operation is null or p_revoke is null or cardinality(p_revoke) not between 1 and 3
      or not p_revoke <@ array['service','ai','social']::text[] then
      raise exception 'FAMILY_PERMISSIONS_INVALID';
    end if;
    if 'service' = any(p_revoke) then
      update public.consents set revoked_at = now()
        where user_id = l.user_id and policy_version = c.policy_version
          and basis = 'parental-guardian' and revoked_at is null;
    else
      update public.capability_grants set revoked_at = now()
        where user_id = l.user_id and policy_version = c.policy_version
          and capability = any(p_revoke) and revoked_at is null;
    end if;
  elsif p_action <> 'VIEW' then
    raise exception 'FAMILY_ACTION_INVALID';
  end if;
  permissions := jsonb_build_object(
    'service',public.family_capability_allowed(l.user_id,c.policy_version,'service'),
    'ai',public.family_capability_allowed(l.user_id,c.policy_version,'ai'),
    'social',public.family_capability_allowed(l.user_id,c.policy_version,'social'));
  output := jsonb_build_object(
    'policy_version',c.policy_version,'permissions',permissions,
    'documents',jsonb_build_object('terms_url',l.terms_url,'privacy_url',l.privacy_url),
    'expires_at',l.expires_at,'accepted_at',l.accepted_at,
    'student_name',(select state->'profile'->>'nickname' from public.student_states where user_id = l.user_id),
    'status',case when p_action = 'VIEW' then 'view' when p_action = 'ACCEPT' then 'accepted' else 'revoked' end);
  if p_action <> 'VIEW' then
    insert into public.operator_audit(target_user_id,consent_id,action,actor_kind,link_id,operation_id,result)
      values(l.user_id,c.id,case when p_action = 'ACCEPT' then 'FAMILY_ACCEPT' else 'FAMILY_REVOKE' end,
        'guardian',l.id,p_operation,output);
  end if;
  return output;
end;
$$;
revoke all on function public.family_access(text,text,uuid,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.family_access(text,text,uuid,jsonb,text[]) to service_role;
