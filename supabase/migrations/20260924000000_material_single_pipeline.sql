-- The worker is the only material processor. Repeated enqueue requests from
-- older clients must not create a second queue message while one is pending.
create or replace function public.enqueue_material(p_user uuid,p_material text)
returns void language plpgsql security definer set search_path='' as $$
declare job public.material_jobs%rowtype;
begin
  if not exists (
    select 1 from public.study_materials
    where user_id=p_user and id=p_material
  ) then raise exception 'NOT_FOUND'; end if;

  insert into public.material_jobs(user_id,material_id)
  values(p_user,p_material)
  on conflict(user_id,material_id) do nothing;
  if found then
    perform pgmq.send('materials',jsonb_build_object('user_id',p_user,'material_id',p_material));
    return;
  end if;

  select * into job from public.material_jobs
  where user_id=p_user and material_id=p_material for update;
  if job.status='FAILED' then
    update public.material_jobs
    set status='QUEUED',attempts=0,error_code=null,updated_at=now()
    where id=job.id;
    perform pgmq.send('materials',jsonb_build_object('user_id',p_user,'material_id',p_material));
  elsif job.status='QUEUED' and job.updated_at<now()-interval '15 minutes'
    and not exists (
      select 1 from pgmq.q_materials q
      where q.message @> jsonb_build_object('user_id',p_user,'material_id',p_material)
    ) then
    -- The previous queue message disappeared without a worker claim.
    update public.material_jobs set updated_at=now() where id=job.id;
    perform pgmq.send('materials',jsonb_build_object('user_id',p_user,'material_id',p_material));
  end if;
end $$;
revoke all on function public.enqueue_material(uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_material(uuid,text) to service_role;
