-- Phase 4, Step 1: work in one branch at a time.
--
-- Phase 3 let a user see every branch they have access to at once. The app
-- needs a single "active" branch, so that screens show one branch's data and
-- new rows land in it. The active branch is the `default_branch_id` claim in
-- the user's JWT (put there by custom_access_token_hook from profiles), so it
-- is signed and cannot be forged. It is only honoured if the user still has a
-- user_branch_access row for it in their org, checked live on every statement;
-- otherwise there is no active branch and everything fails closed.

-- ------------------------------------------------------------------
-- A. The active branch
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
  where uba.user_id = (select auth.uid())
    and uba.branch_id = nullif(auth.jwt() ->> 'default_branch_id', '')::uuid
    and b.organization_id = (select private.current_org_id());
$$;

revoke execute on function private.active_branch_id() from public, anon;
grant execute on function private.active_branch_id() to authenticated;

-- ------------------------------------------------------------------
-- B. Tenant tables: only the active branch, and defaults so inserts need
--    not name the org or branch at all.
-- ------------------------------------------------------------------
-- Writes are held to the same rule: an explicit branch_id that differs from
-- the active branch is rejected by WITH CHECK, so a user can't write into one
-- branch while looking at another.
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'customers', 'roles', 'employees', 'materials', 'vendors',
    'app_settings', 'expense_types', 'expense_subtypes', 'orders',
    'customer_payments', 'customer_writeoffs', 'attendance', 'salary_batches',
    'salary_ledger', 'salary_batch_items', 'vendor_materials', 'inventory_stock',
    'procurements', 'vendor_payments', 'vendor_procurement_settlements',
    'production_entries', 'inventory_adjustments', 'cash_ledger_days',
    'cash_ledger_entries', 'loans', 'loan_ledger', 'order_loadmen',
    'product_inventory', 'withdrawals', 'account_transfers', 'expenses'
  ]
  loop
    execute format('drop policy tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I for all to authenticated
         using (
           organization_id = (select private.current_org_id())
           and branch_id = (select private.active_branch_id())
         )
         with check (
           organization_id = (select private.current_org_id())
           and branch_id = (select private.active_branch_id())
         )', t);
    execute format(
      'alter table public.%I
         alter column organization_id set default private.current_org_id(),
         alter column branch_id set default private.active_branch_id()', t);
  end loop;
end
$$;

-- ------------------------------------------------------------------
-- C. Switching branch
-- ------------------------------------------------------------------
-- profiles is read-only to users (Phase 3), so switching goes through this
-- function. It only moves the caller's own default_branch_id, and only to a
-- branch they have access to within their own org. The client then refreshes
-- its session so the hook mints a token carrying the new branch.
create or replace function public.set_active_branch(p_branch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.profiles p
     set default_branch_id = p_branch_id
   where p.id = v_uid
     and exists (
       select 1
       from public.user_branch_access uba
       join public.branches b on b.id = uba.branch_id
       where uba.user_id = v_uid
         and uba.branch_id = p_branch_id
         and b.organization_id = p.organization_id
     );

  if not found then
    raise exception 'You do not have access to that branch' using errcode = '42501';
  end if;

  return p_branch_id;
end;
$$;

revoke execute on function public.set_active_branch(uuid) from public, anon;
grant execute on function public.set_active_branch(uuid) to authenticated;
