create table public.pets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index pets_user_id_idx on public.pets using btree (user_id);
alter table public.pets enable row level security;
revoke all on table public.pets from anon, authenticated;
grant select on table public.pets to authenticated;
grant all on table public.pets to service_role;

create policy pets_select_own
on public.pets for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.sync_pet_projection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.pets
  where user_id = new.user_id
    and id not in (
      select value->>'id'
      from jsonb_array_elements(coalesce(new.state->'ownedPets', '[]'::jsonb)) value
    );

  insert into public.pets(user_id, id, data)
  select new.user_id, value->>'id', value
  from jsonb_array_elements(coalesce(new.state->'ownedPets', '[]'::jsonb)) value
  where nullif(value->>'id', '') is not null
  on conflict(user_id, id)
  do update set data = excluded.data, updated_at = now();

  return new;
end
$$;

revoke all on function private.sync_pet_projection() from public, anon, authenticated;

create trigger sync_pet_projection_after_state
after insert or update of state on public.student_states
for each row execute function private.sync_pet_projection();

-- Backfill projections for accounts that already contain pet state.
insert into public.pets(user_id, id, data)
select states.user_id, value->>'id', value
from public.student_states states
cross join lateral jsonb_array_elements(coalesce(states.state->'ownedPets', '[]'::jsonb)) value
where nullif(value->>'id', '') is not null
on conflict(user_id, id) do update set data = excluded.data, updated_at = now();
