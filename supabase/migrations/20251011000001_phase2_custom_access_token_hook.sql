-- Phase 2, Step 1: Custom Access Token Auth Hook.
--
-- Supabase Auth calls this function on every sign-in and token refresh,
-- handing it the default claims it's about to mint and letting us add to
-- them. We inject organization_id, default_branch_id, and is_super_admin
-- from the user's profiles row, so Phase 3's RLS policies (and the
-- frontend's future OrgContext) can read them straight off the JWT instead
-- of an extra query.
--
-- NOT yet wired up on the hosted project — that step requires a one-time
-- toggle in the Supabase Dashboard (Authentication -> Hooks), which isn't
-- reachable through any available automation here. See chat for the exact
-- steps.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_organization_id uuid;
  v_default_branch_id uuid;
  v_is_super_admin boolean;
begin
  v_user_id := (event->>'user_id')::uuid;

  select organization_id, default_branch_id, is_super_admin
    into v_organization_id, v_default_branch_id, v_is_super_admin
  from public.profiles
  where id = v_user_id;

  claims := event->'claims';

  claims := jsonb_set(claims, '{organization_id}', coalesce(to_jsonb(v_organization_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{default_branch_id}', coalesce(to_jsonb(v_default_branch_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{is_super_admin}', to_jsonb(coalesce(v_is_super_admin, false)));

  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

-- Standard Supabase Auth Hook permission pattern: supabase_auth_admin needs
-- to be able to call the function and read profiles; nobody else should be
-- able to invoke the hook function directly via RPC.
grant usage on schema public to supabase_auth_admin;

grant execute
  on function public.custom_access_token_hook
  to supabase_auth_admin;

revoke execute
  on function public.custom_access_token_hook
  from authenticated, anon, public;

grant select
  on public.profiles
  to supabase_auth_admin;
