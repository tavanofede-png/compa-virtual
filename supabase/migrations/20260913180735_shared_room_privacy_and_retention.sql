-- Export only this account's contributions, never another member's private data.
create function public.shared_room_export(p_user uuid) returns jsonb
language sql set search_path='' as $$
 select jsonb_build_object('authored_goals',coalesce((
  select jsonb_agg(to_jsonb(g)-'created_by' order by g.created_at)
  from private.shared_room_goals g where g.created_by=p_user),'[]'::jsonb));
$$;
revoke all on function public.shared_room_export(uuid) from public,anon,authenticated;
grant execute on function public.shared_room_export(uuid) to service_role;

create function private.remove_shared_room_contributions() returns trigger
language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 for sid in select distinct session_id from private.shared_room_goals where created_by=old.id loop
  delete from private.shared_room_goals where session_id=sid and created_by=old.id;
  perform private.shared_room_notify(sid);
 end loop;
 return old;
end $$;
revoke all on function private.remove_shared_room_contributions() from public,anon,authenticated;
create trigger remove_shared_room_contributions before delete on auth.users
for each row execute function private.remove_shared_room_contributions();

-- Operational presence has a 75-second lease; remove expired rows every five
-- minutes, including rooms that no one opens again. No activity history is kept.
create function private.cleanup_shared_room_presence() returns integer
language plpgsql security definer set search_path='' as $$
declare removed integer;begin
 delete from private.shared_room_presence where expires_at<=now();
 get diagnostics removed=row_count;
 return removed;
end $$;
revoke all on function private.cleanup_shared_room_presence() from public,anon,authenticated;
grant execute on function private.cleanup_shared_room_presence() to service_role;
do $$ begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
  perform cron.schedule('compa-shared-room-presence-cleanup','*/5 * * * *',
   'select private.cleanup_shared_room_presence()');
 end if;
end $$;
