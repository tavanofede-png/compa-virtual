-- A single account cannot occupy two live room leases at once. Preserve the
-- existing room command and its receipts; serialize enter across sessions by
-- the same per-account advisory lock already used by the room controller.
alter function public.shared_room_command(uuid,uuid,jsonb,jsonb) rename to shared_room_command_base;

create function public.shared_room_command(
  p_user uuid, p_operation uuid, p_command jsonb, p_appearance jsonb default '{}'
) returns jsonb language plpgsql set search_path = '' as $$
declare sid uuid := (p_command->>'session_id')::uuid;
begin
  if p_command->>'action' = 'room.enter' then
    perform pg_advisory_xact_lock(hashtextextended(p_user::text, 718));
    delete from private.shared_room_presence
      where user_id = p_user and expires_at <= now();
    if exists(select 1 from private.shared_room_presence
      where user_id = p_user and session_id <> sid and expires_at > now())
      then raise exception 'ROOM_OTHER_SESSION';
    end if;
  end if;
  return public.shared_room_command_base(p_user, p_operation, p_command, p_appearance);
end $$;
revoke all on function public.shared_room_command(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.shared_room_command(uuid,uuid,jsonb,jsonb) to service_role;
