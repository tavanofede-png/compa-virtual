-- Supabase creates this helper when automatic RLS is enabled for the project.
-- It is an event-trigger implementation detail and must not be callable through
-- the exposed API roles. Keep the migration portable when the helper is absent.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
