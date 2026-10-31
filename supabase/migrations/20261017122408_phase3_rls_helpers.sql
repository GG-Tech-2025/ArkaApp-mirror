-- Phase 3, Step 1: helper functions used by every RLS policy.
--
-- They live in a `private` schema, which is not in the API's exposed-schemas
-- list (supabase/config.toml: [api] schemas), so PostgREST can't offer them as
-- RPC endpoints. Policies still call them: RLS expressions run as the querying
-- role, so `authenticated` gets USAGE on the schema and EXECUTE on each function.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Org of the signed-in user, read from the JWT claim that
-- custom_access_token_hook injects at sign-in/refresh (Phase 2). NULL for
-- anonymous users and for platform super-admins (who belong to no org).
create or replace function private.current_org_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'organization_id', '')::uuid;
$$;

-- Branches the signed-in user may touch: their user_branch_access rows,
-- restricted to branches of the org in their JWT. Read live (not from the
-- JWT) so granting or revoking branch access takes effect immediately.
-- SECURITY DEFINER so it can read user_branch_access/branches without
-- recursing into their own RLS policies.
create or replace function private.accessible_branch_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select uba.branch_id
  from public.user_branch_access uba
  join public.branches b on b.id = uba.branch_id
  where uba.user_id = (select auth.uid())
    and b.organization_id = (select private.current_org_id());
$$;

revoke execute on function private.current_org_id() from public, anon;
revoke execute on function private.accessible_branch_ids() from public, anon;
grant execute on function private.current_org_id() to authenticated;
grant execute on function private.accessible_branch_ids() to authenticated;
