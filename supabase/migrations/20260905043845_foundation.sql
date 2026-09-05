-- Canonical per-student aggregate + relational read projections.
-- Only the authenticated Edge API may commit transitions, using optimistic versioning.
create extension if not exists vector with schema extensions;
create extension if not exists pgmq;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.student_states (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version bigint not null default 0,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.student_states enable row level security;
-- No direct client reads: the API removes private quiz solutions before sending a snapshot.

create table public.operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null, version bigint not null, created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.operations enable row level security;

create table public.point_transactions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null, amount integer not null, reason text not null,
 created_at timestamptz not null default now(), unique(user_id,operation_id)
);
alter table public.point_transactions enable row level security;
create policy own_points on public.point_transactions for select to authenticated using(user_id=(select auth.uid()));
grant select on public.point_transactions to authenticated;

create table public.profiles (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.profiles enable row level security;
create policy own_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
grant select on public.profiles to authenticated;

create table public.companions (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.companions enable row level security;
create policy own_read on public.companions for select to authenticated using(user_id=(select auth.uid()));
grant select on public.companions to authenticated;

create table public.subjects (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.subjects enable row level security;
create policy own_read on public.subjects for select to authenticated using(user_id=(select auth.uid()));
grant select on public.subjects to authenticated;

create table public.weekly_schedule_items (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.weekly_schedule_items enable row level security;
create policy own_read on public.weekly_schedule_items for select to authenticated using(user_id=(select auth.uid()));
grant select on public.weekly_schedule_items to authenticated;

create table public.academic_items (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.academic_items enable row level security;
create policy own_read on public.academic_items for select to authenticated using(user_id=(select auth.uid()));
grant select on public.academic_items to authenticated;

create table public.study_plans (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.study_plans enable row level security;
create policy own_read on public.study_plans for select to authenticated using(user_id=(select auth.uid()));
grant select on public.study_plans to authenticated;

create table public.study_sessions (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.study_sessions enable row level security;
create policy own_read on public.study_sessions for select to authenticated using(user_id=(select auth.uid()));
grant select on public.study_sessions to authenticated;

create table public.daily_checkins (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.daily_checkins enable row level security;
create policy own_read on public.daily_checkins for select to authenticated using(user_id=(select auth.uid()));
grant select on public.daily_checkins to authenticated;

create table public.study_materials (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.study_materials enable row level security;
create policy own_read on public.study_materials for select to authenticated using(user_id=(select auth.uid()));
grant select on public.study_materials to authenticated;

create table public.quiz_sets (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.quiz_sets enable row level security;

create table public.quiz_attempts (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.quiz_attempts enable row level security;
create policy own_read on public.quiz_attempts for select to authenticated using(user_id=(select auth.uid()));
grant select on public.quiz_attempts to authenticated;

create table public.academic_memories (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.academic_memories enable row level security;
create policy own_read on public.academic_memories for select to authenticated using(user_id=(select auth.uid()));
grant select on public.academic_memories to authenticated;

create table public.conversation_messages (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.conversation_messages enable row level security;
create policy own_read on public.conversation_messages for select to authenticated using(user_id=(select auth.uid()));
grant select on public.conversation_messages to authenticated;

create table public.notifications (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.notifications enable row level security;
create policy own_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
grant select on public.notifications to authenticated;

alter table public.academic_items add column subject_id text generated always as (data->>'subject_id') stored;
alter table public.academic_items add constraint academic_subject_owner foreign key(user_id,subject_id) references public.subjects(user_id,id) deferrable initially deferred;
alter table public.study_materials add column subject_id text generated always as (data->>'subject_id') stored;
alter table public.study_materials add constraint material_subject_owner foreign key(user_id,subject_id) references public.subjects(user_id,id) deferrable initially deferred;
create index academic_due on public.academic_items(user_id, (data->>'due_date'));
create index materials_subject on public.study_materials(user_id,subject_id);

create table public.study_material_chunks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 material_id text not null, ordinal integer not null, label text not null, content text not null,
 embedding extensions.vector(1536), search tsvector generated always as (to_tsvector('spanish',content)) stored,
 unique(user_id,material_id,ordinal),
 foreign key(user_id,material_id) references public.study_materials(user_id,id) on delete cascade
);
alter table public.study_material_chunks enable row level security;
create policy own_chunks on public.study_material_chunks for select to authenticated using(user_id=(select auth.uid()));
grant select on public.study_material_chunks to authenticated;
create index chunks_fts on public.study_material_chunks using gin(search);
create index chunks_owner on public.study_material_chunks(user_id,material_id);

create table public.devices (
 token text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in ('ios','android')), enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.devices enable row level security;
create table public.push_deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 device_token text not null references public.devices(token) on delete cascade, local_date date not null,
 kind text not null, ticket_id text, status text not null default 'PENDING',
 created_at timestamptz not null default now(), unique(device_token,local_date,kind)
);
alter table public.push_deliveries enable row level security;
create table public.consents (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 policy_version text not null, basis text not null, evidence_reference text,
 verified_at timestamptz, created_at timestamptz not null default now()
);
alter table public.consents enable row level security;
create policy own_consents on public.consents for select to authenticated using(user_id=(select auth.uid()));
grant select on public.consents to authenticated;
create table public.ai_usage (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 purpose text not null, model text not null, input_tokens integer not null, output_tokens integer not null,
 cost_usd numeric(12,6), created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
create table public.material_jobs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 material_id text not null, status text not null default 'QUEUED', attempts integer not null default 0,
 error_code text,updated_at timestamptz not null default now(),
 unique(user_id,material_id),foreign key(user_id,material_id) references public.study_materials(user_id,id) on delete cascade
);
alter table public.material_jobs enable row level security;
create policy own_jobs on public.material_jobs for select to authenticated using(user_id=(select auth.uid()));
grant select on public.material_jobs to authenticated;
select pgmq.create('materials');
create table public.learning_methods (id text primary key, data jsonb not null);
alter table public.learning_methods enable row level security;
create policy methods_public on public.learning_methods for select to authenticated using(true);
grant select on public.learning_methods to authenticated;

create or replace function public.commit_state(p_user uuid,p_expected bigint,p_operation uuid,p_state jsonb,p_reason text)
returns bigint language plpgsql security definer set search_path='' as $$
declare current_version bigint; old_state jsonb; target_version bigint; entry jsonb; delta integer; relation_name text; field_name text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select version into target_version from public.operations where user_id=p_user and operation_id=p_operation;
 if found then return target_version; end if;
 select version,state into current_version,old_state from public.student_states where user_id=p_user for update;
 if not found then current_version:=0;old_state:='{"coins":0}'::jsonb;end if;
 if current_version<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if jsonb_typeof(p_state)<>'object' or (p_state->>'coins')::int<0 then raise exception 'INVALID_STATE';end if;
 if p_state->'profile'<>'null'::jsonb and p_state->'profile'->>'id'<>p_user::text then raise exception 'OWNER_MISMATCH';end if;
 target_version:=current_version+1;
 insert into public.student_states(user_id,version,state) values(p_user,target_version,p_state)
 on conflict(user_id) do update set version=excluded.version,state=excluded.state,updated_at=now();
delete from public.profiles where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(case when p_state->'profile'='null'::jsonb then '[]'::jsonb else jsonb_build_array(p_state->'profile') end));
 insert into public.profiles(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(case when p_state->'profile'='null'::jsonb then '[]'::jsonb else jsonb_build_array(p_state->'profile') end)
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.companions where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(case when p_state->'companion'='null'::jsonb then '[]'::jsonb else jsonb_build_array(p_state->'companion') end));
 insert into public.companions(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(case when p_state->'companion'='null'::jsonb then '[]'::jsonb else jsonb_build_array(p_state->'companion') end)
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.subjects where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'subjects','[]'::jsonb)));
 insert into public.subjects(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'subjects','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.weekly_schedule_items where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'blocks','[]'::jsonb)));
 insert into public.weekly_schedule_items(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'blocks','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.academic_items where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'items','[]'::jsonb)));
 insert into public.academic_items(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'items','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.study_plans where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'plans','[]'::jsonb)));
 insert into public.study_plans(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'plans','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.study_sessions where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'sessions','[]'::jsonb)));
 insert into public.study_sessions(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'sessions','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.daily_checkins where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'checkins','[]'::jsonb)));
 insert into public.daily_checkins(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'checkins','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.study_materials where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'materials','[]'::jsonb)));
 insert into public.study_materials(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'materials','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.quiz_sets where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'quizzes','[]'::jsonb)));
 insert into public.quiz_sets(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'quizzes','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.quiz_attempts where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'attempts','[]'::jsonb)));
 insert into public.quiz_attempts(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'attempts','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.academic_memories where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'memories','[]'::jsonb)));
 insert into public.academic_memories(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'memories','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.conversation_messages where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'messages','[]'::jsonb)));
 insert into public.conversation_messages(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'messages','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();
delete from public.notifications where user_id=p_user and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_state->'notifications','[]'::jsonb)));
 insert into public.notifications(user_id,id,data) select p_user,value->>'id',value from jsonb_array_elements(coalesce(p_state->'notifications','[]'::jsonb))
 on conflict(user_id,id) do update set data=excluded.data,updated_at=now();

 delta:=(p_state->>'coins')::int-coalesce((old_state->>'coins')::int,0);
 if delta<>0 then insert into public.point_transactions(user_id,operation_id,amount,reason) values(p_user,p_operation,delta,p_reason);end if;
 insert into public.operations(user_id,operation_id,version) values(p_user,p_operation,target_version);
 return target_version;
end $$;
revoke all on function public.commit_state(uuid,bigint,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_state(uuid,bigint,uuid,jsonb,text) to service_role;

create or replace function public.search_materials(p_user uuid,p_material text,p_query text,p_embedding extensions.vector(1536))
returns table(id uuid,material_id text,label text,content text,score double precision)
language sql stable security definer set search_path='' as $$
 select c.id,c.material_id,c.label,c.content,
 (coalesce(1-(c.embedding operator(extensions.<=>) p_embedding),0)+ts_rank(c.search,plainto_tsquery('spanish',p_query)))::double precision score
 from public.study_material_chunks c where c.user_id=p_user and (p_material is null or c.material_id=p_material)
 order by score desc,c.ordinal limit 8;
$$;
revoke all on function public.search_materials(uuid,text,text,extensions.vector) from public,anon,authenticated;
grant execute on function public.search_materials(uuid,text,text,extensions.vector) to service_role;

create or replace function public.enqueue_material(p_user uuid,p_material text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.study_materials where user_id=p_user and id=p_material) then raise exception 'NOT_FOUND';end if;
 insert into public.material_jobs(user_id,material_id) values(p_user,p_material)
 on conflict(user_id,material_id) do update set status='QUEUED',attempts=0,error_code=null,updated_at=now()
 where public.material_jobs.status='FAILED';
 if found then
   perform pgmq.send('materials',jsonb_build_object('user_id',p_user,'material_id',p_material));
 end if;
end $$;
revoke all on function public.enqueue_material(uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_material(uuid,text) to service_role;
create or replace function public.read_material_job()
returns table(msg_id bigint,read_ct integer,message jsonb) language sql security definer set search_path='' as $$
 select msg_id,read_ct,message from pgmq.read('materials',300,1);
$$;
create or replace function public.ack_material_job(p_id bigint)
returns boolean language sql security definer set search_path='' as $$select pgmq.delete('materials',p_id)$$;
create or replace function public.extend_material_job(p_id bigint)
returns void language sql security definer set search_path='' as $$select pgmq.set_vt('materials',p_id,300)$$;
revoke all on function public.read_material_job(),public.ack_material_job(bigint),public.extend_material_job(bigint) from public,anon,authenticated;
grant execute on function public.read_material_job(),public.ack_material_job(bigint),public.extend_material_job(bigint) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('materials','materials',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy own_material_read on storage.objects for select to authenticated using(bucket_id='materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Uploads use short-lived signed URLs minted by the authenticated API; no public upload grant.

grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

create table private.ai_leases(user_id uuid primary key references auth.users(id) on delete cascade,expires_at timestamptz not null);
create or replace function public.acquire_ai_lease(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into private.ai_leases values(p_user,now()+interval '3 minutes')
 on conflict(user_id) do update set expires_at=excluded.expires_at where private.ai_leases.expires_at<now();
 return found;
end $$;
create or replace function public.release_ai_lease(p_user uuid) returns void language sql security definer set search_path='' as $$delete from private.ai_leases where user_id=p_user$$;
revoke all on function public.acquire_ai_lease(uuid),public.release_ai_lease(uuid) from public,anon,authenticated;
grant execute on function public.acquire_ai_lease(uuid),public.release_ai_lease(uuid) to service_role;

create or replace function public.finish_material(p_user uuid,p_material text,p_status text,p_error text,p_chunks jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare current_state jsonb; current_version bigint; material jsonb; new_materials jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select state,version into current_state,current_version from public.student_states where user_id=p_user for update;
 if not found then return;end if;
 select value into material from jsonb_array_elements(current_state->'materials') where value->>'id'=p_material;
 if not found then return;end if;
 if p_status not in ('PROCESSING','READY','FAILED') then raise exception 'INVALID_STATUS';end if;
 if p_status='READY' then
  delete from public.study_material_chunks where user_id=p_user and material_id=p_material;
  insert into public.study_material_chunks(user_id,material_id,ordinal,label,content,embedding)
  select p_user,p_material,(v->>'ordinal')::int,v->>'label',v->>'content',(v->>'embedding')::extensions.vector
  from jsonb_array_elements(p_chunks) v;
 end if;
 select jsonb_agg(case when value->>'id'=p_material then value || jsonb_build_object('status',p_status,'error_message',p_error) else value end)
 into new_materials from jsonb_array_elements(current_state->'materials');
 current_state:=jsonb_set(current_state,'{materials}',new_materials);
 perform public.commit_state(p_user,current_version,gen_random_uuid(),current_state,'material.'||lower(p_status));
 update public.material_jobs set status=p_status,error_code=p_error,updated_at=now(),attempts=attempts+case when p_status='PROCESSING' then 1 else 0 end where user_id=p_user and material_id=p_material;
end $$;
revoke all on function public.finish_material(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_material(uuid,text,text,text,jsonb) to service_role;

create or replace function public.purge_chat_history() returns integer language plpgsql security definer set search_path='' as $$
declare row_record record; filtered jsonb; count_users integer:=0;
begin
 for row_record in select user_id from public.student_states loop
  perform pg_advisory_xact_lock(hashtextextended(row_record.user_id::text,0));
  select user_id,state,version into row_record from public.student_states where user_id=row_record.user_id for update;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into filtered from jsonb_array_elements(row_record.state->'messages') where (value->>'created_at')::timestamptz>=now()-interval '30 days';
  if filtered<>row_record.state->'messages' then
   perform public.commit_state(row_record.user_id,row_record.version,gen_random_uuid(),jsonb_set(row_record.state,'{messages}',filtered),'retention.purge');
   count_users:=count_users+1;
  end if;
 end loop;
 return count_users;
end $$;
revoke all on function public.purge_chat_history() from public,anon,authenticated;
grant execute on function public.purge_chat_history() to service_role;


create table public.account_controls(user_id uuid primary key references auth.users(id) on delete cascade,deleting boolean not null default false,updated_at timestamptz not null default now());
alter table public.account_controls enable row level security;
grant all on public.account_controls to service_role;

create view public.companion_rooms with(security_invoker=true) as select user_id,id,data->>'room_theme' as theme,data->>'decoration' as decoration from public.companions;
create view public.study_plan_items with(security_invoker=true) as select p.user_id,p.id as plan_id,s->>'id' as id,s as data from public.study_plans p cross join lateral jsonb_array_elements(p.data->'slots') s;
create view public.quiz_answers with(security_invoker=true) as select a.user_id,a.id as attempt_id,r->>'question_id' as question_id,r as data from public.quiz_attempts a cross join lateral jsonb_array_elements(a.data->'results') r;
create view public.academic_item_sources with(security_invoker=true) as select user_id,id as academic_item_id,data->>'source' as source,data->>'description' as description from public.academic_items;
grant select on public.companion_rooms,public.study_plan_items,public.quiz_answers,public.academic_item_sources to authenticated;

create or replace function public.append_notification(p_user uuid,p_notification jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s jsonb;v bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select state,version into s,v from public.student_states where user_id=p_user for update;
 if not found then return;end if;
 if exists(select 1 from jsonb_array_elements(s->'notifications') n where n->>'id'=p_notification->>'id') then return;end if;
 s:=jsonb_set(s,'{notifications}',coalesce(s->'notifications','[]'::jsonb)||jsonb_build_array(p_notification));
 perform public.commit_state(p_user,v,gen_random_uuid(),s,'notification.create');
end $$;
revoke all on function public.append_notification(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.append_notification(uuid,jsonb) to service_role;

