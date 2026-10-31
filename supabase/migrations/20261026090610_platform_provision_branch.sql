-- Platform: add a branch to an existing client organization (super-admin only).
--
-- One transaction: create the branch, give it its defaults (cash account, the two settings,
-- the five materials) and let every ADMIN of the organization use it. Employees are not
-- touched: each employee belongs to one branch and gets access when their login is created.
--
-- Unlike provision_organization this needs no service role (it creates no logins), so a
-- super-admin's own session may call it. The check is inside the function, read live from
-- profiles and requiring an organization-less token (private.is_super_admin()); the grant
-- to `authenticated` is therefore intentional and is the same pattern as set_active_branch.

create or replace function public.provision_branch(
  p_organization_id uuid,
  p_name text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_status text;
  v_branch uuid;
  v_admins integer;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Only platform administrators can add branches' using errcode = '42501';
  end if;

  if v_name = '' or length(v_name) > 200 then
    raise exception 'Branch name is required (up to 200 characters)' using errcode = '22023';
  end if;
  if v_code = '' or length(v_code) > 20 then
    raise exception 'Branch code is required (up to 20 characters)' using errcode = '22023';
  end if;

  select o.status into v_status from public.organizations o where o.id = p_organization_id;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'Organization is not active' using errcode = '55000';
  end if;

  insert into public.branches (organization_id, name, code)
  values (p_organization_id, v_name, v_code)
  returning id into v_branch;

  perform public.seed_branch_defaults(v_branch);

  insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role)
  select p.id, v_branch, p.organization_id, 'MANAGER'
  from public.profiles p
  where p.organization_id = p_organization_id and p.role = 'ADMIN';
  get diagnostics v_admins = row_count;

  return jsonb_build_object('branch_id', v_branch, 'admins_granted', v_admins);
end;
$$;

revoke execute on function public.provision_branch(uuid, text, text) from public, anon;
grant execute on function public.provision_branch(uuid, text, text) to authenticated, service_role;
