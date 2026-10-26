-- Phase 6: manual branch billing and pausing (no billing provider).
--
-- Each branch carries a last payment date, a renewal date and a status. The platform operator
-- records payments and pauses/resumes branches by hand; a history log keeps who did what.
--
-- 1. branches.last_payment_date / renewal_date (status ACTIVE|INACTIVE already existed, unused).
-- 2. branch_billing_events: the history. Platform-only: only a super-admin can read it, nobody
--    can write it directly (every write goes through the functions below).
-- 3. Enforcement: private.active_branch_id() now also requires the branch AND its organization
--    to be ACTIVE. Every tenant policy and every client-data function goes through that one
--    rule, so a paused branch reads and writes nothing, instantly, for admins and employees
--    alike, even for people already signed in. Other branches of the same client keep working.
--    set_active_branch() refuses to switch to a paused branch.
-- 4. Operator functions (super-admin only, checked inside, called from the platform screens):
--    platform_set_branch_status, platform_record_payment, platform_set_renewal_date,
--    platform_set_org_status, platform_list_org_admins.
-- 5. provision_organization / provision_branch now take the first renewal date (there is no
--    trial period any more; organizations.plan and trial_ends_at are no longer used).

-- ------------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------------
alter table public.branches
  add column if not exists last_payment_date date,
  add column if not exists renewal_date date;

-- ------------------------------------------------------------------
-- 2. History
-- ------------------------------------------------------------------
create table public.branch_billing_events (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id),
  branch_id          uuid,
  event_type         text not null check (event_type in
                       ('CREATED', 'PAYMENT', 'PAUSED', 'RESUMED', 'RENEWAL_CHANGED', 'ORG_PAUSED', 'ORG_RESUMED')),
  happened_on        date not null default (timezone('Asia/Kolkata', now()))::date,
  amount             numeric(12, 2) check (amount is null or amount >= 0),
  reference          text,
  note               text,
  renewal_date_after date,
  actor_id           uuid,
  created_at         timestamptz not null default now(),
  constraint branch_billing_events_branch_fkey
    foreign key (branch_id, organization_id) references public.branches (id, organization_id)
);

create index branch_billing_events_branch_idx on public.branch_billing_events (branch_id, created_at desc);
create index branch_billing_events_org_idx on public.branch_billing_events (organization_id, created_at desc);

alter table public.branch_billing_events enable row level security;
create policy super_admin_read on public.branch_billing_events
  for select to authenticated
  using ((select private.is_super_admin()));
revoke all on public.branch_billing_events from anon, authenticated;
grant select on public.branch_billing_events to authenticated;

-- ------------------------------------------------------------------
-- 3. Enforcement
-- ------------------------------------------------------------------
create or replace function private.active_branch_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select uba.branch_id
  from public.user_branch_access uba
  join public.branches b on b.id = uba.branch_id
  join public.organizations o on o.id = b.organization_id
  where uba.user_id = (select auth.uid())
    and uba.branch_id = nullif(auth.jwt() ->> 'default_branch_id', '')::uuid
    and b.organization_id = (select private.current_org_id())
    and b.status = 'ACTIVE'
    and o.status = 'ACTIVE';
$$;

create or replace function public.set_active_branch(p_branch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_paused boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.organization_id into v_org from public.profiles p where p.id = v_uid;

  select (b.status <> 'ACTIVE' or o.status <> 'ACTIVE')
    into v_paused
  from public.user_branch_access uba
  join public.branches b on b.id = uba.branch_id
  join public.organizations o on o.id = b.organization_id
  where uba.user_id = v_uid
    and uba.branch_id = p_branch_id
    and b.organization_id = v_org;

  if v_paused is null then
    raise exception 'You do not have access to that branch' using errcode = '42501';
  end if;
  if v_paused then
    raise exception 'That branch is paused. Please contact support' using errcode = '55000';
  end if;

  update public.profiles set default_branch_id = p_branch_id where id = v_uid;
  return p_branch_id;
end;
$$;

-- ------------------------------------------------------------------
-- 4. Operator functions (super-admin only)
-- ------------------------------------------------------------------
create or replace function public.platform_set_branch_status(p_branch_id uuid, p_active boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_new text := case when p_active then 'ACTIVE' else 'INACTIVE' end;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Only platform administrators can change a branch''s status' using errcode = '42501';
  end if;
  if p_active is null then
    raise exception 'Active or paused is required' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 500 then
    raise exception 'The note is too long (500 characters at most)' using errcode = '22023';
  end if;

  select b.organization_id, b.status into v_org, v_status from public.branches b where b.id = p_branch_id;
  if not found then
    raise exception 'Branch not found' using errcode = 'P0002';
  end if;
  if v_status = v_new then
    return v_new;  -- already in that state: nothing to change, nothing to log
  end if;

  update public.branches set status = v_new where id = p_branch_id;
  insert into public.branch_billing_events (organization_id, branch_id, event_type, note, actor_id)
  values (v_org, p_branch_id, case when p_active then 'RESUMED' else 'PAUSED' end,
          nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()));
  return v_new;
end;
$$;

create or replace function public.platform_record_payment(
  p_branch_id uuid,
  p_paid_on date,
  p_renewal_date date,
  p_amount numeric default null,
  p_reference text default null,
  p_note text default null,
  p_resume boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_org uuid;
  v_status text;
  v_last date;
  v_actor uuid := (select auth.uid());
begin
  if not (select private.is_super_admin()) then
    raise exception 'Only platform administrators can record payments' using errcode = '42501';
  end if;
  if p_paid_on is null or p_paid_on > v_today then
    raise exception 'The payment date is required and cannot be in the future' using errcode = '22023';
  end if;
  if p_renewal_date is null or p_renewal_date <= p_paid_on then
    raise exception 'The new renewal date is required and must be after the payment date' using errcode = '22023';
  end if;
  if p_amount is not null and (p_amount < 0 or p_amount >= 10000000000) then
    raise exception 'The amount must be a positive number' using errcode = '22023';
  end if;
  if length(coalesce(p_reference, '')) > 200 or length(coalesce(p_note, '')) > 500 then
    raise exception 'The reference or note is too long' using errcode = '22023';
  end if;

  select b.organization_id, b.status, b.last_payment_date into v_org, v_status, v_last
  from public.branches b where b.id = p_branch_id for update;
  if not found then
    raise exception 'Branch not found' using errcode = 'P0002';
  end if;

  update public.branches
     set last_payment_date = greatest(coalesce(v_last, p_paid_on), p_paid_on),
         renewal_date = p_renewal_date
   where id = p_branch_id;

  insert into public.branch_billing_events
    (organization_id, branch_id, event_type, happened_on, amount, reference, note, renewal_date_after, actor_id)
  values (v_org, p_branch_id, 'PAYMENT', p_paid_on, p_amount,
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''),
          p_renewal_date, v_actor);

  if p_resume and v_status = 'INACTIVE' then
    update public.branches set status = 'ACTIVE' where id = p_branch_id;
    insert into public.branch_billing_events (organization_id, branch_id, event_type, note, actor_id)
    values (v_org, p_branch_id, 'RESUMED', 'Resumed on payment', v_actor);
  end if;

  return (select jsonb_build_object('status', b.status, 'last_payment_date', b.last_payment_date, 'renewal_date', b.renewal_date)
          from public.branches b where b.id = p_branch_id);
end;
$$;

create or replace function public.platform_set_renewal_date(p_branch_id uuid, p_renewal_date date, p_note text default null)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Only platform administrators can change a renewal date' using errcode = '42501';
  end if;
  if p_renewal_date is null then
    raise exception 'The renewal date is required' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 500 then
    raise exception 'The note is too long (500 characters at most)' using errcode = '22023';
  end if;

  select b.organization_id into v_org from public.branches b where b.id = p_branch_id for update;
  if not found then
    raise exception 'Branch not found' using errcode = 'P0002';
  end if;

  update public.branches set renewal_date = p_renewal_date where id = p_branch_id;
  insert into public.branch_billing_events (organization_id, branch_id, event_type, note, renewal_date_after, actor_id)
  values (v_org, p_branch_id, 'RENEWAL_CHANGED', nullif(btrim(coalesce(p_note, '')), ''), p_renewal_date, (select auth.uid()));
  return p_renewal_date;
end;
$$;

create or replace function public.platform_set_org_status(p_organization_id uuid, p_active boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_new text := case when p_active then 'ACTIVE' else 'SUSPENDED' end;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Only platform administrators can change an organization''s status' using errcode = '42501';
  end if;
  if p_active is null then
    raise exception 'Active or suspended is required' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 500 then
    raise exception 'The note is too long (500 characters at most)' using errcode = '22023';
  end if;

  select o.status into v_status from public.organizations o where o.id = p_organization_id for update;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
  if v_status = 'CANCELLED' then
    raise exception 'A cancelled organization cannot be changed here' using errcode = '55000';
  end if;
  if v_status = v_new then
    return v_new;
  end if;

  update public.organizations set status = v_new where id = p_organization_id;
  insert into public.branch_billing_events (organization_id, event_type, note, actor_id)
  values (p_organization_id, case when p_active then 'ORG_RESUMED' else 'ORG_PAUSED' end,
          nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()));
  return v_new;
end;
$$;

create or replace function public.platform_list_org_admins(p_organization_id uuid)
returns table (user_id uuid, phone text, email text, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_super_admin()) then
    raise exception 'Only platform administrators can list a client''s admins' using errcode = '42501';
  end if;

  return query
  select p.id, p.phone::text, u.email::text, u.last_sign_in_at, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.organization_id = p_organization_id and p.role = 'ADMIN'
  order by u.created_at;
end;
$$;

-- ------------------------------------------------------------------
-- 5. Creating organizations and branches now takes the first renewal date
-- ------------------------------------------------------------------
drop function if exists public.provision_organization(text, text, text, text, uuid, text, text, text, integer);

create or replace function public.provision_organization(
  p_name text,
  p_slug text,
  p_branch_name text,
  p_branch_code text,
  p_admin_user_id uuid,
  p_admin_phone text,
  p_renewal_date date,
  p_contact_email text default null,
  p_last_payment_date date default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (timezone('Asia/Kolkata', now()))::date;
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
  if p_renewal_date is null or p_renewal_date < v_today then
    raise exception 'The renewal date is required and cannot be in the past' using errcode = '22023';
  end if;
  if p_last_payment_date is not null and p_last_payment_date > v_today then
    raise exception 'The last payment date cannot be in the future' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_admin_user_id) then
    raise exception 'Admin user not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_admin_user_id) then
    raise exception 'That user already has a profile' using errcode = '23505';
  end if;

  insert into public.organizations (name, slug, contact_email, contact_phone)
  values (btrim(p_name), p_slug, nullif(btrim(coalesce(p_contact_email, '')), ''), btrim(p_admin_phone))
  returning id into v_org;

  insert into public.branches (organization_id, name, code, last_payment_date, renewal_date)
  values (v_org, btrim(p_branch_name), v_code, p_last_payment_date, p_renewal_date)
  returning id into v_branch;

  insert into public.branch_billing_events (organization_id, branch_id, event_type, renewal_date_after, actor_id)
  values (v_org, v_branch, 'CREATED', p_renewal_date, p_actor_id);

  insert into public.profiles (id, phone, role, organization_id, default_branch_id, is_super_admin)
  values (p_admin_user_id, btrim(p_admin_phone), 'ADMIN', v_org, v_branch, false);

  insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role)
  values (p_admin_user_id, v_branch, v_org, 'MANAGER');

  perform public.seed_branch_defaults(v_branch);

  return jsonb_build_object('organization_id', v_org, 'branch_id', v_branch);
end;
$$;

revoke execute on function public.provision_organization(text, text, text, text, uuid, text, date, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.provision_organization(text, text, text, text, uuid, text, date, text, date, uuid)
  to service_role;

drop function if exists public.provision_branch(uuid, text, text);

create or replace function public.provision_branch(
  p_organization_id uuid,
  p_name text,
  p_code text,
  p_renewal_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (timezone('Asia/Kolkata', now()))::date;
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
  if p_renewal_date is null or p_renewal_date < v_today then
    raise exception 'The renewal date is required and cannot be in the past' using errcode = '22023';
  end if;

  select o.status into v_status from public.organizations o where o.id = p_organization_id;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'Organization is not active' using errcode = '55000';
  end if;

  insert into public.branches (organization_id, name, code, renewal_date)
  values (p_organization_id, v_name, v_code, p_renewal_date)
  returning id into v_branch;

  insert into public.branch_billing_events (organization_id, branch_id, event_type, renewal_date_after, actor_id)
  values (p_organization_id, v_branch, 'CREATED', p_renewal_date, (select auth.uid()));

  perform public.seed_branch_defaults(v_branch);

  insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role)
  select p.id, v_branch, p.organization_id, 'MANAGER'
  from public.profiles p
  where p.organization_id = p_organization_id and p.role = 'ADMIN';
  get diagnostics v_admins = row_count;

  return jsonb_build_object('branch_id', v_branch, 'admins_granted', v_admins);
end;
$$;

-- grants for the operator functions and the new provision_branch
revoke execute on function public.platform_set_branch_status(uuid, boolean, text) from public, anon;
revoke execute on function public.platform_record_payment(uuid, date, date, numeric, text, text, boolean) from public, anon;
revoke execute on function public.platform_set_renewal_date(uuid, date, text) from public, anon;
revoke execute on function public.platform_set_org_status(uuid, boolean, text) from public, anon;
revoke execute on function public.platform_list_org_admins(uuid) from public, anon;
revoke execute on function public.provision_branch(uuid, text, text, date) from public, anon;
grant execute on function public.platform_set_branch_status(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.platform_record_payment(uuid, date, date, numeric, text, text, boolean) to authenticated, service_role;
grant execute on function public.platform_set_renewal_date(uuid, date, text) to authenticated, service_role;
grant execute on function public.platform_set_org_status(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.platform_list_org_admins(uuid) to authenticated, service_role;
grant execute on function public.provision_branch(uuid, text, text, date) to authenticated, service_role;
