-- Members may discover a group's scheduled/active meetings, but only an
-- explicit, capacity-checked join grants the roster, room and seat access.
create function public.collaboration_group_sessions(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(private.collaboration_session(s.id) || jsonb_build_object('joinable', true)
    order by s.scheduled_start_at desc), '[]'::jsonb)
  from (
    select meeting.id, meeting.scheduled_start_at
    from public.group_study_sessions meeting
    join public.study_groups g on g.id = meeting.group_id and g.status = 'active'
    join public.study_group_members member on member.group_id = g.id and member.user_id = p_user
    where meeting.status in ('scheduled', 'active')
      and not exists (select 1 from public.group_session_participants participant
        where participant.session_id = meeting.id and participant.user_id = p_user)
    order by meeting.scheduled_start_at desc limit 100
  ) s;
$$;
revoke all on function public.collaboration_group_sessions(uuid) from public, anon, authenticated;
grant execute on function public.collaboration_group_sessions(uuid) to service_role;

create function public.collaboration_join_group_session(
  p_user uuid, p_operation uuid, p_command jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  sid uuid := (p_command->>'session_id')::uuid;
  gid uuid;
  s public.group_study_sessions;
  op private.collaboration_operations;
  result jsonb;
  used integer;
  capacity integer;
  pending_invite uuid;
begin
  if p_operation is null or p_command->>'action' <> 'session.join' or sid is null
    then raise exception 'COLLAB_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 718));
  select group_id into gid from public.group_study_sessions where id = sid;
  if gid is null then raise exception 'COLLAB_NOT_FOUND'; end if;
  perform 1 from public.study_groups where id = gid and status = 'active' for update;
  if not found then raise exception 'COLLAB_NOT_FOUND'; end if;
  select * into s from public.group_study_sessions where id = sid for update;
  if not found or s.group_id <> gid or s.status not in ('scheduled', 'active')
    or not exists (select 1 from public.study_group_members
      where group_id = gid and user_id = p_user)
    then raise exception 'COLLAB_NOT_FOUND'; end if;
  -- Membership is rechecked before replay: an old receipt cannot restore a
  -- place after the member was removed from the group.
  select * into op from private.collaboration_operations
    where user_id = p_user and operation_id = p_operation;
  if found then
    if op.command <> p_command then raise exception 'COLLAB_CONFLICT'; end if;
    return op.result;
  end if;
  result := jsonb_build_object('session_id', sid);
  if not exists (select 1 from public.group_session_participants
    where session_id = sid and user_id = p_user) then
    if s.revision <> (p_command->>'revision')::integer then raise exception 'COLLAB_CONFLICT'; end if;
    select max_participants into capacity from public.space_templates where id = s.space_template_id;
    select count(*) into used from public.group_session_participants where session_id = sid;
    used := used + (select count(*) from private.collaboration_invitations
      where session_id = sid and status = 'pending' and expires_at > now());
    select id into pending_invite from private.collaboration_invitations
      where session_id = sid and recipient_id = p_user
        and status = 'pending' and expires_at > now() for update;
    -- A direct group join may consume the caller's own reserved invitation.
    if used - (case when pending_invite is null then 0 else 1 end) >= capacity
      then raise exception 'COLLAB_FULL'; end if;
    insert into public.group_session_participants(session_id, user_id) values(sid, p_user);
    if pending_invite is not null then
      update private.collaboration_invitations set status = 'accepted' where id = pending_invite;
    end if;
    update public.group_study_sessions set revision = revision + 1 where id = sid;
  end if;
  insert into private.collaboration_operations(user_id, operation_id, command, result)
    values(p_user, p_operation, p_command, result);
  return result;
end $$;
revoke all on function public.collaboration_join_group_session(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.collaboration_join_group_session(uuid,uuid,jsonb) to service_role;
