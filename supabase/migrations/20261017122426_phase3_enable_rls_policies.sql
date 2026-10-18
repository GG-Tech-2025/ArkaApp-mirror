-- Phase 3, Step 3: turn on RLS everywhere and add the policies.
--
-- Until now RLS was off on every public table, so anyone holding the anon key
-- could read and write all data. After this migration the default is deny:
-- a role sees rows only if a policy says so, and only `authenticated` has any.

-- ------------------------------------------------------------------
-- A. Tenant data tables: org wall + branch filter (one uniform policy)
-- ------------------------------------------------------------------
-- A row is visible/writable only if its organization_id matches the org in
-- the caller's JWT AND its branch_id is one the caller has access to.
-- WITH CHECK applies the same test to INSERT and to the new values of UPDATE,
-- so a row can't be created in, or moved to, a branch the caller lacks.
-- `(select ...)` makes Postgres evaluate each helper once per statement
-- instead of once per row.
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
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy tenant_isolation on public.%I for all to authenticated
         using (
           organization_id = (select private.current_org_id())
           and branch_id in (select private.accessible_branch_ids())
         )
         with check (
           organization_id = (select private.current_org_id())
           and branch_id in (select private.accessible_branch_ids())
         )', t);
  end loop;
end
$$;

-- ------------------------------------------------------------------
-- B. Platform tables: read-only for normal users
-- ------------------------------------------------------------------
-- No INSERT/UPDATE/DELETE policies, so ordinary users can't create orgs or
-- branches, hand themselves branch access, or edit their own profile (which
-- would let them set is_super_admin or change org). Writes happen through the
-- service role / SQL editor now, and a super-admin control plane in Phase 5.

alter table public.organizations enable row level security;
create policy own_org_read on public.organizations
  for select to authenticated
  using (id = (select private.current_org_id()));

alter table public.branches enable row level security;
create policy accessible_branches_read on public.branches
  for select to authenticated
  using (id in (select private.accessible_branch_ids()));

alter table public.user_branch_access enable row level security;
create policy own_access_read on public.user_branch_access
  for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.profiles enable row level security;
create policy own_profile_read on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- custom_access_token_hook runs as supabase_auth_admin and reads profiles at
-- every sign-in. Without this policy it would see no rows and silently stop
-- adding the tenancy claims to the JWT.
create policy auth_admin_read on public.profiles
  for select to supabase_auth_admin
  using (true);

-- Second layer behind the missing write policies: these roles can't write the
-- tenancy-critical tables at the privilege level either.
revoke insert, update, delete, truncate
  on public.profiles, public.organizations, public.branches, public.user_branch_access
  from anon, authenticated;
