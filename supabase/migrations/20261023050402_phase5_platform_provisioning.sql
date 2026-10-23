-- Phase 5 PR 1: the platform operator's side of the database.
--
-- 1. private.is_super_admin(): true only for a profile flagged is_super_admin while the
--    token carries NO organization. A super-admin is the vendor, not a member of any
--    client org (profiles.organization_id is null for them), so a flagged user who also
--    belongs to an org gets no extra reach from the flag. Read live, not from the token.
-- 2. Read-only super_admin_read policies on the four PLATFORM tables only. There is
--    deliberately no policy of any kind on the tenant tables: a super-admin sees no
--    client business data, and gets no write access to the platform tables either (all
--    writes go through provision_organization / the service role).
-- 3. public.provision_organization(): creates an organization, its first branch, the
--    first admin's profile and branch access, and the branch defaults, in one
--    transaction. Callable only by the service role (an Edge Function creates the
--    admin's login first and calls it, after checking the caller is a super-admin).

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           (select p.is_super_admin from public.profiles p where p.id = (select auth.uid())),
           false)
         and (select private.current_org_id()) is null;
$$;

create policy super_admin_read on public.organizations
  for select to authenticated
  using ((select private.is_super_admin()));

create policy super_admin_read on public.branches
  for select to authenticated
  using ((select private.is_super_admin()));

create policy super_admin_read on public.profiles
  for select to authenticated
  using ((select private.is_super_admin()));

create policy super_admin_read on public.user_branch_access
  for select to authenticated
  using ((select private.is_super_admin()));

create or replace function public.provision_organization(
  p_name text,
  p_slug text,
  p_branch_name text,
  p_branch_code text,
  p_admin_user_id uuid,
  p_admin_phone text,
  p_contact_email text default null,
  p_plan text default 'trial',
  p_trial_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_branch uuid;
  v_code text := upper(btrim(coalesce(p_branch_code, '')));
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Organization name is required' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug must be lowercase letters and numbers, with single hyphens between words' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_branch_name, '')), '') is null or v_code = '' then
    raise exception 'Branch name and code are required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_admin_phone, '')), '') is null then
    raise exception 'Admin phone is required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_plan, '')), '') is null or p_trial_days is null or p_trial_days not between 1 and 365 then
    raise exception 'Plan is required and the trial must be 1 to 365 days' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_admin_user_id) then
    raise exception 'Admin user not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_admin_user_id) then
    raise exception 'That user already has a profile' using errcode = '23505';
  end if;

  insert into public.organizations (name, slug, contact_email, contact_phone, plan, trial_ends_at)
  values (btrim(p_name), p_slug, nullif(btrim(coalesce(p_contact_email, '')), ''), btrim(p_admin_phone),
          btrim(p_plan),
          case when btrim(p_plan) = 'trial' then now() + make_interval(days => p_trial_days) end)
  returning id into v_org;

  insert into public.branches (organization_id, name, code)
  values (v_org, btrim(p_branch_name), v_code)
  returning id into v_branch;

  insert into public.profiles (id, phone, role, organization_id, default_branch_id, is_super_admin)
  values (p_admin_user_id, btrim(p_admin_phone), 'ADMIN', v_org, v_branch, false);

  insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role)
  values (p_admin_user_id, v_branch, v_org, 'MANAGER');

  perform public.seed_branch_defaults(v_branch);

  return jsonb_build_object('organization_id', v_org, 'branch_id', v_branch);
end;
$$;

revoke execute on function public.provision_organization(text, text, text, text, uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.provision_organization(text, text, text, text, uuid, text, text, text, integer)
  to service_role;
