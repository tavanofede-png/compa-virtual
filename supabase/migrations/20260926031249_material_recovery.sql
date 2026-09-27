-- Deploy together with the v2 worker. Old processors cannot finish v2 work.
alter table public.material_jobs
  add column pipeline_version integer not null default 1,
  add column generation integer not null default 1,
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column queue_message_id bigint,
  add column phase text not null default 'WAITING',
  add column completed_units integer not null default 0,
  add column total_units integer,
  add column text_ready boolean not null default false,
  add column text_complete boolean not null default false,
  add column indexing_status text not null default 'PENDING',
  add column started_at timestamptz,
  add column finished_at timestamptz;
alter table public.material_jobs add constraint material_job_progress_check
  check (generation>0 and completed_units>=0 and (total_units is null or total_units>=completed_units)
    and phase in ('WAITING','EXTRACTING','OCR','INDEXING','COMPLETE','FAILED','CANCELLED')
    and indexing_status in ('PENDING','PROCESSING','READY','FAILED','UNAVAILABLE','CANCELLED'));
create index material_jobs_attention on public.material_jobs(status,updated_at);

create table public.material_page_checkpoints (
  user_id uuid not null, material_id text not null,
  ordinal integer not null check(ordinal between 0 and 1999),
  label text not null check(length(label) between 1 and 120),
  content text not null check(length(content)<=250000),
  needs_ocr boolean not null, updated_at timestamptz not null default now(),
  primary key(user_id,material_id,ordinal),
  foreign key(user_id,material_id) references public.study_materials(user_id,id) on delete cascade
);
alter table public.material_page_checkpoints enable row level security;
revoke all on public.material_page_checkpoints from public,anon,authenticated;
grant all on public.material_page_checkpoints to service_role;

create function private.material_patch(p_user uuid,p_material text,p_patch jsonb,p_operation uuid default null,p_expected bigint default null)
returns void language plpgsql security definer set search_path='' as $$
declare s jsonb; v bigint; patched jsonb;
begin
  -- All callers already hold this same lock; reentrant acquisition is safe.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select state,version into s,v from public.student_states where user_id=p_user for update;
  if not found then raise exception 'MATERIAL_NOT_FOUND';end if;
  if p_expected is not null and p_expected<>v then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
  select jsonb_agg(case when x->>'id'=p_material then x||p_patch else x end)
    into patched from jsonb_array_elements(s->'materials') x;
  if p_operation is not null or patched is distinct from s->'materials' then
    perform public.commit_state(p_user,v,coalesce(p_operation,gen_random_uuid()),
      jsonb_set(s,'{materials}',patched),'material.pipeline');
  end if;
end $$;
revoke all on function private.material_patch(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

create function public.material_enqueue_v2(p_user uuid,p_material text,p_expected bigint default null,p_operation uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare j public.material_jobs%rowtype; mat jsonb; op record; q record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  perform 1 from public.student_states where user_id=p_user for update;
  if exists(select 1 from public.account_controls where user_id=p_user and deleting) then raise exception 'ACCOUNT_DELETING';end if;
  if p_operation is not null and exists(select 1 from public.operations where user_id=p_user and operation_id=p_operation) then return;end if;
  select data into mat from public.study_materials where user_id=p_user and id=p_material;
  if not found then raise exception 'MATERIAL_NOT_FOUND';end if;
  if p_expected is not null and p_expected<>(select version from public.student_states where user_id=p_user) then
    raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
  select * into j from public.material_jobs where user_id=p_user and material_id=p_material for update;
  if found and j.pipeline_version=2 then
    if (j.phase='COMPLETE' and j.indexing_status='READY') or
       (j.status<>'FAILED' and j.phase in ('WAITING','EXTRACTING','OCR','INDEXING') and
         (j.lease_expires_at>now() or exists(select 1 from pgmq.q_materials where msg_id=j.queue_message_id))) then
      perform private.material_patch(p_user,p_material,'{}',p_operation,p_expected);return;
    end if;
  end if;
  -- Remove only messages belonging to this owner's material before a new generation.
  for q in select msg_id from pgmq.q_materials where message @> jsonb_build_object('user_id',p_user,'material_id',p_material) loop
    perform pgmq.delete('materials',q.msg_id);
  end loop;
  insert into public.material_jobs(user_id,material_id,pipeline_version)
    values(p_user,p_material,2) on conflict(user_id,material_id) do nothing;
  update public.material_jobs set pipeline_version=2,
    generation=case when j.id is null then 1 else generation+1 end,
    status='QUEUED',attempts=0,error_code=null,phase='WAITING',completed_units=0,total_units=null,
    lease_token=null,lease_expires_at=null,finished_at=null,updated_at=now(),
    text_ready=coalesce(j.text_ready,false),text_complete=coalesce(j.text_complete,false),indexing_status='PENDING'
    where user_id=p_user and material_id=p_material returning * into j;
  update public.material_jobs set queue_message_id=(select pgmq.send('materials',
    jsonb_build_object('user_id',p_user,'material_id',p_material,'generation',j.generation))) where id=j.id;
  perform private.material_patch(p_user,p_material,jsonb_build_object(
    'status',case when j.text_ready then 'READY' else 'QUEUED' end,
    'error_message',null,'text_ready',j.text_ready,'indexing_status','PENDING'),p_operation,p_expected);
end $$;
revoke all on function public.material_enqueue_v2(uuid,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.material_enqueue_v2(uuid,text,bigint,uuid) to service_role;

create or replace function public.enqueue_material(p_user uuid,p_material text)
returns void language sql security definer set search_path='' as $$
  select public.material_enqueue_v2(p_user,p_material);
$$;

create function public.material_cancel_v2(p_user uuid,p_material text,p_expected bigint,p_operation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare j public.material_jobs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  perform 1 from public.student_states where user_id=p_user for update;
  if exists(select 1 from public.operations where user_id=p_user and operation_id=p_operation) then return;end if;
  if not exists(select 1 from public.study_materials where user_id=p_user and id=p_material) then raise exception 'MATERIAL_NOT_FOUND';end if;
  select * into j from public.material_jobs where user_id=p_user and material_id=p_material for update;
  if j.queue_message_id is not null then perform pgmq.delete('materials',j.queue_message_id);end if;
  update public.material_jobs set generation=generation+1,lease_token=null,lease_expires_at=null,
    queue_message_id=null,status='CANCELLED',phase='CANCELLED',indexing_status='CANCELLED',
    completed_units=0,total_units=null,error_code=null,updated_at=now(),finished_at=now() where id=j.id;
  perform private.material_patch(p_user,p_material,jsonb_build_object(
    'status',case when j.text_ready then 'READY' else 'CANCELLED' end,
    'error_message',null,'indexing_status','CANCELLED'),p_operation,p_expected);
end $$;
revoke all on function public.material_cancel_v2(uuid,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.material_cancel_v2(uuid,text,bigint,uuid) to service_role;

create function public.read_material_job_v2()
returns table(msg_id bigint,read_ct integer,message jsonb) language plpgsql security definer set search_path='' as $$
declare q record;
begin
  select * into q from pgmq.read('materials',120,1);
  if not found then return;end if;
  if q.message->>'generation' is null then
    if exists(select 1 from public.study_materials where user_id=(q.message->>'user_id')::uuid and id=q.message->>'material_id') then
      perform public.material_enqueue_v2((q.message->>'user_id')::uuid,q.message->>'material_id');
    end if;
    perform pgmq.delete('materials',q.msg_id);return;
  end if;
  if not exists(select 1 from public.material_jobs where user_id=(q.message->>'user_id')::uuid
      and material_id=q.message->>'material_id' and generation=(q.message->>'generation')::int
      and queue_message_id=q.msg_id and phase not in ('COMPLETE','FAILED','CANCELLED')) then
    perform pgmq.delete('materials',q.msg_id);return;
  end if;
  return query select q.msg_id::bigint,q.read_ct::integer,q.message::jsonb;
end $$;
revoke all on function public.read_material_job_v2() from public,anon,authenticated;
grant execute on function public.read_material_job_v2() to service_role;
-- Quarantine obsolete workers during the coordinated upgrade.
create or replace function public.read_material_job()
returns table(msg_id bigint,read_ct integer,message jsonb) language sql security definer set search_path='' as $$
  select null::bigint,null::integer,null::jsonb where false;
$$;
create or replace function public.finish_material(p_user uuid,p_material text,p_status text,p_error text,p_chunks jsonb)
returns void language sql security definer set search_path='' as $$select$$;

create function public.material_job_event(p_user uuid,p_material text,p_generation integer,p_lease uuid,p_event text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.material_jobs%rowtype; patch jsonb:='{}'; vectors jsonb; chunk jsonb; complete boolean; terminal boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  perform 1 from public.student_states where user_id=p_user for update;
  if not found then return jsonb_build_object('accepted',false);end if;
  select * into j from public.material_jobs where user_id=p_user and material_id=p_material for update;
  if not found or j.pipeline_version<>2 or j.generation<>p_generation or j.phase in ('COMPLETE','FAILED','CANCELLED') or
    exists(select 1 from public.account_controls where user_id=p_user and deleting) then
    return jsonb_build_object('accepted',false);end if;
  if p_event='CLAIM' then
    if p_lease is null or j.lease_expires_at>now() then return jsonb_build_object('accepted',false);end if;
    if j.attempts>=3 then
      update public.material_jobs set status=case when text_ready then 'READY' else 'FAILED' end,
        phase='FAILED',indexing_status='FAILED',lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now(),
        error_code='El procesamiento se interrumpió varias veces. Se conserva el original; podés reintentar.' where id=j.id;
      perform private.material_patch(p_user,p_material,jsonb_build_object('status',case when j.text_ready then 'READY' else 'FAILED' end,
        'indexing_status','FAILED','error_message','El procesamiento se interrumpió varias veces. Se conserva el original; podés reintentar.'));
      perform pgmq.delete('materials',j.queue_message_id);
      return jsonb_build_object('accepted',false);
    end if;
    update public.material_jobs set lease_token=p_lease,lease_expires_at=now()+interval '120 seconds',
      attempts=attempts+1,status='PROCESSING',phase=case when text_complete then 'INDEXING' else 'EXTRACTING' end,
      started_at=coalesce(started_at,now()),updated_at=now() where id=j.id;
    perform private.material_patch(p_user,p_material,jsonb_build_object('status',case when j.text_ready then 'READY' else 'PROCESSING' end));
    return jsonb_build_object('accepted',true,'attempt',j.attempts+1);
  end if;
  if j.lease_token is distinct from p_lease or p_lease is null or j.lease_expires_at<=now() then
    return jsonb_build_object('accepted',false);end if;
  if p_event='HEARTBEAT' then
    update public.material_jobs set lease_expires_at=now()+interval '120 seconds',updated_at=now() where id=j.id;
    perform pgmq.set_vt('materials',j.queue_message_id,120);
  elsif p_event='PROGRESS' then
    if p_data->>'phase' not in ('EXTRACTING','OCR','INDEXING') or
      (p_data->>'completed')::int<0 or (p_data->>'total')::int<(p_data->>'completed')::int then raise exception 'INVALID_PROGRESS';end if;
    update public.material_jobs set phase=p_data->>'phase',completed_units=(p_data->>'completed')::int,
      total_units=(p_data->>'total')::int,updated_at=now() where id=j.id;
  elsif p_event='PAGE' then
    insert into public.material_page_checkpoints(user_id,material_id,ordinal,label,content,needs_ocr)
      values(p_user,p_material,(p_data->>'ordinal')::int,p_data->>'label',p_data->>'text',(p_data->>'needs_ocr')::boolean)
      on conflict(user_id,material_id,ordinal) do update set label=excluded.label,content=excluded.content,needs_ocr=excluded.needs_ocr,updated_at=now();
  elsif p_event='TEXT' then
    if jsonb_typeof(p_data->'chunks')<>'array' or jsonb_array_length(p_data->'chunks') not between 1 and 600 then raise exception 'INVALID_CHUNKS';end if;
    for chunk in select value from jsonb_array_elements(p_data->'chunks') loop
      if length(chunk->>'content') not between 1 and 1800 or length(chunk->>'label') not between 1 and 120 or (chunk->>'ordinal')::int<0 then raise exception 'INVALID_CHUNKS';end if;
    end loop;
    insert into public.study_material_chunks(user_id,material_id,ordinal,label,content)
      select p_user,p_material,(c->>'ordinal')::int,c->>'label',c->>'content' from jsonb_array_elements(p_data->'chunks') c
      on conflict(user_id,material_id,ordinal) do update set label=excluded.label,content=excluded.content,
        embedding=case when public.study_material_chunks.content=excluded.content then public.study_material_chunks.embedding else null end;
    delete from public.study_material_chunks where user_id=p_user and material_id=p_material
      and ordinal not in (select (c->>'ordinal')::int from jsonb_array_elements(p_data->'chunks') c);
    complete:=coalesce((p_data->>'complete')::boolean,false);
    update public.material_jobs set text_ready=true,text_complete=complete,indexing_status='PENDING',updated_at=now() where id=j.id;
    patch:=jsonb_build_object('status','READY','text_ready',true,'text_complete',complete,'page_count',(p_data->>'page_count')::int,'error_message',null,'indexing_status','PENDING');
  elsif p_event='VECTORS' then
    if jsonb_typeof(p_data->'chunks')<>'array' or jsonb_array_length(p_data->'chunks') not between 1 and 24 then raise exception 'INVALID_VECTORS';end if;
    for chunk in select value from jsonb_array_elements(p_data->'chunks') loop
      if jsonb_array_length(chunk->'embedding')<>1536 then raise exception 'INVALID_VECTORS';end if;
      update public.study_material_chunks set embedding=(chunk->>'embedding')::extensions.vector
        where user_id=p_user and material_id=p_material and id=(chunk->>'id')::uuid;
      if not found then raise exception 'CHUNK_NOT_FOUND';end if;
    end loop;
    update public.material_jobs set indexing_status='PROCESSING',updated_at=now() where id=j.id;
  elsif p_event in ('DONE','UNAVAILABLE','FAIL') then
    terminal:=p_event<>'FAIL' or coalesce((p_data->>'terminal')::boolean,false) or j.attempts>=3;
    if p_event='DONE' and (not j.text_ready or not j.text_complete or exists(select 1 from public.study_material_chunks where user_id=p_user and material_id=p_material and embedding is null)) then raise exception 'INDEX_INCOMPLETE';end if;
    update public.material_jobs set lease_token=null,lease_expires_at=null,
      status=case when text_ready then 'READY' when terminal then 'FAILED' else 'PROCESSING' end,
      phase=case when p_event='DONE' then 'COMPLETE' when terminal then 'FAILED' else 'WAITING' end,
      indexing_status=case when p_event='DONE' then 'READY' when p_event='UNAVAILABLE' then 'UNAVAILABLE' when terminal then 'FAILED' else 'PENDING' end,
      error_code=left(p_data->>'error',300),finished_at=case when terminal then now() else null end,updated_at=now()
      where id=j.id returning * into j;
    patch:=jsonb_build_object('status',case when j.text_ready then 'READY' when terminal then 'FAILED' else 'PROCESSING' end,
      'error_message',j.error_code,'indexing_status',j.indexing_status);
    if terminal then perform pgmq.delete('materials',j.queue_message_id);
    else perform pgmq.set_vt('materials',j.queue_message_id,30*j.attempts);end if;
  else raise exception 'INVALID_EVENT';end if;
  if patch<>'{}'::jsonb then perform private.material_patch(p_user,p_material,patch);end if;
  return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.material_job_event(uuid,text,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.material_job_event(uuid,text,integer,uuid,text,jsonb) to service_role;

create table public.material_operator_actions (
  id uuid primary key default gen_random_uuid(),operator_user_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,material_id text not null,
  operation_id uuid not null,reason text not null,created_at timestamptz not null default now(),
  unique(operator_user_id,operation_id)
);
alter table public.material_operator_actions enable row level security;
revoke all on public.material_operator_actions from public,anon,authenticated;
grant all on public.material_operator_actions to service_role;
create function public.operator_retry_material(p_operator uuid,p_user uuid,p_material text,p_operation uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if length(trim(p_reason)) not between 8 and 300 then raise exception 'REASON_REQUIRED';end if;
  insert into public.material_operator_actions(operator_user_id,user_id,material_id,operation_id,reason)
    values(p_operator,p_user,p_material,p_operation,p_reason) on conflict(operator_user_id,operation_id) do nothing;
  if not found then return;end if;
  perform public.material_enqueue_v2(p_user,p_material);
end $$;
revoke all on function public.operator_retry_material(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.operator_retry_material(uuid,uuid,text,uuid,text) to service_role;

-- Delete the aggregate first; object removal can be retried without resurrecting data.
create table public.material_object_deletions (
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check(path like user_id::text||'/%'),
  created_at timestamptz not null default now(),primary key(user_id,path)
);
alter table public.material_object_deletions enable row level security;
revoke all on public.material_object_deletions from public,anon,authenticated;
grant all on public.material_object_deletions to service_role;
create function public.material_delete_v2(p_user uuid,p_material text,p_expected bigint,p_operation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s jsonb; v bigint; mat jsonb; ids text[]; q record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select state,version into s,v from public.student_states where user_id=p_user for update;
  if exists(select 1 from public.operations where user_id=p_user and operation_id=p_operation) then return;end if;
  if v<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
  select value into mat from jsonb_array_elements(s->'materials') where value->>'id'=p_material;
  if not found then raise exception 'MATERIAL_NOT_FOUND';end if;
  insert into public.material_object_deletions(user_id,path) values(p_user,mat->>'path') on conflict do nothing;
  for q in select msg_id from pgmq.q_materials where message @> jsonb_build_object('user_id',p_user,'material_id',p_material) loop
    perform pgmq.delete('materials',q.msg_id);
  end loop;
  select coalesce(array_agg(x->>'id'),'{}') into ids from jsonb_array_elements(s->'quizzes') x where x->>'material_id'=p_material;
  s:=jsonb_set(s,'{materials}',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'materials') x where x->>'id'<>p_material),'[]'));
  s:=jsonb_set(s,'{quizzes}',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'quizzes') x where not(x->>'id'=any(ids))),'[]'));
  s:=jsonb_set(s,'{attempts}',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'attempts') x where not(x->>'quiz_id'=any(ids))),'[]'));
  s:=jsonb_set(s,'{flashcard_reviews}',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(s->'flashcard_reviews','[]')) x where not(x->>'quiz_id'=any(ids))),'[]'));
  s:=jsonb_set(s,'{correction_bonuses}',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(s->'correction_bonuses','[]')) x where not(x#>>'{}'=any(ids))),'[]'));
  s:=jsonb_set(s,'{messages}',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'messages') x
    where not exists(select 1 from jsonb_array_elements(coalesce(x->'citations','[]')) c where c->>'material_id'=p_material)),'[]'));
  perform public.commit_state(p_user,v,p_operation,s,'material.delete');
end $$;
revoke all on function public.material_delete_v2(uuid,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.material_delete_v2(uuid,text,bigint,uuid) to service_role;
