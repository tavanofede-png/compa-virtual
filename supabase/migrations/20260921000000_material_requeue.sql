-- A retry must recreate the transport message even when the previous job row
-- remained QUEUED/PROCESSING after a worker outage. The original function only
-- retried FAILED rows, leaving orphaned queued documents impossible to recover.
create or replace function public.enqueue_material(p_user uuid,p_material text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.study_materials where user_id=p_user and id=p_material) then raise exception 'NOT_FOUND';end if;
 insert into public.material_jobs(user_id,material_id) values(p_user,p_material)
 on conflict(user_id,material_id) do update
   set status='QUEUED',attempts=0,error_code=null,updated_at=now()
   where public.material_jobs.status<>'READY';
 if found then
   perform pgmq.send('materials',jsonb_build_object('user_id',p_user,'material_id',p_material));
 end if;
end $$;
revoke all on function public.enqueue_material(uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_material(uuid,text) to service_role;
