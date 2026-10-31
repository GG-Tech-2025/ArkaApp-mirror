-- Phase 6, PR 1: enforce roles in the database.
--
-- Until now tenant_isolation (org + active branch) was the only gate, so any signed-in user of a
-- branch -- including an EMPLOYEE calling the API directly with their own token -- could read and
-- write every tenant table, salaries, loans and cash included. The UI hid the admin screens;
-- nothing else did.
--
-- After this migration, per tenant table:
--   tenant_isolation  RESTRICTIVE  the org + active-branch wall every role must pass (unchanged test)
--   admin_all         PERMISSIVE   profiles.role = 'ADMIN' may do everything inside the wall
--   employee_*        PERMISSIVE   an active EMPLOYEE gets only what src/employee/** needs
-- A role with no permissive policy on a table sees and writes nothing there.
--
-- Roles are read live from profiles (not from the JWT) so demoting a user or deactivating an
-- employee takes effect immediately, the same way branch access already does.

-- ------------------------------------------------------------------
-- A. Role helpers
-- ------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'ADMIN'
      and p.organization_id = (select private.current_org_id())
  );
$$;

-- An EMPLOYEE login whose employees row (matched by phone, like the app's own
-- checkEmployeeIsActive) is active and belongs to the active branch.
create or replace function private.is_active_employee()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.employees e
      on e.phone = p.phone
     and e.organization_id = p.organization_id
    where p.id = (select auth.uid())
      and p.role = 'EMPLOYEE'
      and p.organization_id = (select private.current_org_id())
      and e.branch_id = (select private.active_branch_id())
      and e.active = true
  );
$$;

revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_active_employee() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_employee() to authenticated;

-- ------------------------------------------------------------------
-- B. Wall + admin policies on every tenant table
-- ------------------------------------------------------------------
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
      'create policy tenant_isolation on public.%I as restrictive for all to authenticated
         using (
           organization_id = (select private.current_org_id())
           and branch_id = (select private.active_branch_id())
         )
         with check (
           organization_id = (select private.current_org_id())
           and branch_id = (select private.active_branch_id())
         )', t);
    execute format(
      'create policy admin_all on public.%I as permissive for all to authenticated
         using ((select private.is_admin()))
         with check ((select private.is_admin()))', t);
  end loop;
end
$$;

-- ------------------------------------------------------------------
-- C. Employee policies: exactly what the employee app does
-- ------------------------------------------------------------------
-- Read: today's deliveries (orders + customer name/phone + loadmen), the pickers on the
-- material-purchase and production screens, and the one app setting delivery needs.
do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'order_loadmen', 'customers', 'materials', 'vendors',
    'app_settings', 'product_inventory', 'inventory_stock'
  ]
  loop
    execute format(
      'create policy employee_read on public.%I as permissive for select to authenticated
         using ((select private.is_active_employee()))', t);
  end loop;
end
$$;

-- Material purchase and production entry only ever insert.
create policy employee_insert on public.procurements
  as permissive for insert to authenticated
  with check ((select private.is_active_employee()) and approved is not true);

create policy employee_insert on public.production_entries
  as permissive for insert to authenticated
  with check ((select private.is_active_employee()));

-- Delivery marks the order delivered, assigns loadmen, and moves stock. Only orders that are not
-- yet delivered can be edited; the trigger in section D limits which columns.
create policy employee_deliver on public.orders
  as permissive for update to authenticated
  using ((select private.is_active_employee()) and delivered is not true)
  with check ((select private.is_active_employee()));

create policy employee_insert on public.order_loadmen
  as permissive for insert to authenticated
  with check ((select private.is_active_employee()));

create policy employee_delete on public.order_loadmen
  as permissive for delete to authenticated
  using ((select private.is_active_employee()));

-- Stock is moved by the client as read-modify-write (PR 5 moves it into the database).
create policy employee_insert on public.product_inventory
  as permissive for insert to authenticated
  with check ((select private.is_active_employee()));
create policy employee_update on public.product_inventory
  as permissive for update to authenticated
  using ((select private.is_active_employee()))
  with check ((select private.is_active_employee()));

create policy employee_insert on public.inventory_stock
  as permissive for insert to authenticated
  with check ((select private.is_active_employee()));
create policy employee_update on public.inventory_stock
  as permissive for update to authenticated
  using ((select private.is_active_employee()))
  with check ((select private.is_active_employee()));

-- Deliberately NOT granted to employees: accounts, cash_*, loans, loan_ledger, withdrawals,
-- account_transfers, expenses*, customer_payments, customer_writeoffs, vendor_payments,
-- vendor_procurement_settlements, salary_*, attendance, inventory_adjustments, vendor_materials,
-- roles, employees, and any write to app_settings/customers/materials/vendors.

-- ------------------------------------------------------------------
-- D. Orders: an employee may only touch the delivery columns
-- ------------------------------------------------------------------
-- RLS works on rows, not columns. Without this an employee could rewrite final_price or
-- customer_id on any undelivered order. auth.uid() is null for the service role and migrations,
-- which stay unrestricted.
create or replace function private.guard_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  delivery_columns constant text[] := array[
    'time', 'brick_quantity', 'location', 'payment_status', 'amount_paid',
    'gst_number', 'dc_number', 'loading_type', 'delivered'
  ];
begin
  if (select auth.uid()) is null or (select private.is_admin()) then
    return new;
  end if;

  if (to_jsonb(new) - delivery_columns) is distinct from (to_jsonb(old) - delivery_columns) then
    raise exception 'Only the delivery details of an order can be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_order_update() from public, anon;

create trigger guard_order_update
  before update on public.orders
  for each row execute function private.guard_order_update();

-- ------------------------------------------------------------------
-- E. Account balance functions are admin-only
-- ------------------------------------------------------------------
-- They are SECURITY INVOKER and callable as RPC by any signed-in user; with no accounts policy
-- for employees the update would match no rows, but fail loudly rather than rely on that.
create or replace function public.increment_account_balance(p_account_id uuid, p_amount numeric)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if (select auth.uid()) is not null and not (select private.is_admin()) then
    raise exception 'Only administrators can change account balances' using errcode = '42501';
  end if;

  update accounts
  set balance = balance + p_amount
  where id = p_account_id;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$function$;

create or replace function public.decrement_account_balance(p_account_id uuid, p_amount numeric)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  current_balance numeric;
begin
  if (select auth.uid()) is not null and not (select private.is_admin()) then
    raise exception 'Only administrators can change account balances' using errcode = '42501';
  end if;

  select balance
  into current_balance
  from accounts
  where id = p_account_id
  for update;

  if current_balance is null then
    raise exception 'Account not found';
  end if;

  if current_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update accounts
  set balance = balance - p_amount
  where id = p_account_id;
end;
$function$;

-- ------------------------------------------------------------------
-- F. Narrow doors for what an employee needs but must not read directly
-- ------------------------------------------------------------------
-- Delivery needs each active employee's name and pay rate to split loader wages, but not their
-- aadhar, addresses or deductions, which sit in the same rows. Same JSON shape the client
-- already got from employees + roles.
create or replace function public.get_delivery_staff()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', e.id,
             'name', e.name,
             'phone', e.phone,
             'role_id', e.role_id,
             'roles', jsonb_build_object(
               'id', r.id,
               'name', r.name,
               'category', r.category,
               'salary_value', r.salary_value,
               'no_loading_salary', r.no_loading_salary
             )
           ) order by e.name), '[]'::jsonb)
  from public.employees e
  join public.roles r on r.id = e.role_id and r.branch_id = e.branch_id
  where e.active = true
    and e.organization_id = (select private.current_org_id())
    and e.branch_id = (select private.active_branch_id())
    and ((select private.is_admin()) or (select private.is_active_employee()));
$$;

-- The employee app logs deactivated employees out. They can no longer read employees, so
-- ask the database directly.
create or replace function public.am_i_active_employee()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_active_employee());
$$;

-- Loader wages: the delivery screen credits each loadman's salary ledger. The running balance
-- is computed here, under a lock on the employee, from the real latest entry -- the client
-- computed it from whatever it could read, and parallel entries raced. Employees get no direct
-- access to salary_ledger.
create or replace function public.record_loader_wage(
  p_employee_id uuid,
  p_amount numeric,
  p_notes text default null,
  p_payment_at timestamptz default null
)
returns public.salary_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (select private.current_org_id());
  v_branch uuid := (select private.active_branch_id());
  v_balance numeric;
  v_row public.salary_ledger;
begin
  if not ((select private.is_admin()) or (select private.is_active_employee())) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_org is null or v_branch is null then
    raise exception 'No active branch' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  perform 1
  from public.employees e
  where e.id = p_employee_id and e.organization_id = v_org and e.branch_id = v_branch
  for update;
  if not found then
    raise exception 'Employee not found' using errcode = 'P0002';
  end if;

  select sl.running_balance into v_balance
  from public.salary_ledger sl
  where sl.employee_id = p_employee_id
    and sl.organization_id = v_org and sl.branch_id = v_branch
  order by sl.created_at desc
  limit 1;

  insert into public.salary_ledger (
    organization_id, branch_id, employee_id, entry_type, amount, running_balance, notes, payment_at,
    created_at
  )
  values (
    v_org, v_branch, p_employee_id, 'SALARY_AUTO_ENTRY', p_amount,
    coalesce(v_balance, 0) + p_amount, p_notes, coalesce(p_payment_at, now()),
    clock_timestamp() -- not now(): entries in one transaction must still order correctly
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.get_delivery_staff() from public, anon;
revoke execute on function public.am_i_active_employee() from public, anon;
revoke execute on function public.record_loader_wage(uuid, numeric, text, timestamptz) from public, anon;
grant execute on function public.get_delivery_staff() to authenticated;
grant execute on function public.am_i_active_employee() to authenticated;
grant execute on function public.record_loader_wage(uuid, numeric, text, timestamptz) to authenticated;
