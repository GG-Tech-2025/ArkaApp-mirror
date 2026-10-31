-- Role enforcement tests (pgTAP). Run with `supabase test db` (CI does this).
--
-- One organization, one branch, three users:
--   uAdmin  ADMIN                         -> keeps full access inside the branch
--   uEmp    EMPLOYEE, active employee     -> only what the employee app needs
--   uOld    EMPLOYEE, employee deactivated -> nothing at all
-- Everything happens in one transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner, so RLS does not apply)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('e0000000-0000-0000-0000-00000000000e', 'Role Test Org', 'role-test-e');

insert into public.branches (id, organization_id, name, code) values
  ('e1000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-00000000000e', 'E1', 'E1');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '', now(), '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('51000000-0000-0000-0000-0000000000e1'::uuid, 'role-admin@test.invalid'),
  ('52000000-0000-0000-0000-0000000000e2'::uuid, 'role-emp@test.invalid'),
  ('53000000-0000-0000-0000-0000000000e3'::uuid, 'role-old@test.invalid')
) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id) values
  ('51000000-0000-0000-0000-0000000000e1', '8300000001', 'ADMIN',    'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1'),
  ('52000000-0000-0000-0000-0000000000e2', '8300000002', 'EMPLOYEE', 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1'),
  ('53000000-0000-0000-0000-0000000000e3', '8300000003', 'EMPLOYEE', 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('51000000-0000-0000-0000-0000000000e1', 'e1000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-00000000000e', 'MANAGER'),
  ('52000000-0000-0000-0000-0000000000e2', 'e1000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-00000000000e', 'STAFF'),
  ('53000000-0000-0000-0000-0000000000e3', 'e1000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-00000000000e', 'STAFF');

insert into public.roles (id, name, category, salary_value, organization_id, branch_id) values
  ('e2000000-0000-0000-0000-0000000000e1', 'Loader', 'LOADMEN', 500, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.employees (id, name, phone, aadhar, role_id, active, organization_id, branch_id) values
  ('e3000000-0000-0000-0000-0000000000e1', 'Emp Active', '8300000002', '111122223333', 'e2000000-0000-0000-0000-0000000000e1', true,  'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1'),
  ('e3000000-0000-0000-0000-0000000000e2', 'Emp Old',    '8300000003', '444455556666', 'e2000000-0000-0000-0000-0000000000e1', false, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.customers (id, name, phone, organization_id, branch_id) values
  ('e4000000-0000-0000-0000-0000000000e1', 'Cust E', '9300000001', 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.orders (id, customer_id, order_date, delivery_date, brick_quantity, final_price, delivered, organization_id, branch_id) values
  ('e5000000-0000-0000-0000-0000000000e1', 'e4000000-0000-0000-0000-0000000000e1', current_date, current_date, 100, 1000, false, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1'),
  ('e5000000-0000-0000-0000-0000000000e2', 'e4000000-0000-0000-0000-0000000000e1', current_date, current_date, 100, 1000, true,  'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1'),
  ('e5000000-0000-0000-0000-0000000000e3', 'e4000000-0000-0000-0000-0000000000e1', current_date, current_date, 100, 1000, false, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.accounts (id, account_number, opening_balance, balance, organization_id, branch_id) values
  ('e6000000-0000-0000-0000-0000000000e1', 'E-BANK', 100, 100, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.loans (id, lender_name, loan_type, principal_amount, outstanding_balance, start_date, organization_id, branch_id) values
  ('e7000000-0000-0000-0000-0000000000e1', 'Lender', 'BANK', 5000, 5000, current_date, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.salary_ledger (id, employee_id, entry_type, amount, running_balance, organization_id, branch_id) values
  ('e8000000-0000-0000-0000-0000000000e1', 'e3000000-0000-0000-0000-0000000000e1', 'SALARY_MANUAL_ENTRY', 300, 300, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.app_settings (id, key, value, organization_id, branch_id) values
  ('e9000000-0000-0000-0000-0000000000e1', 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', '2', 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.materials (id, name, unit, organization_id, branch_id) values
  ('ea000000-0000-0000-0000-0000000000e1', 'Fly Ash', 'KG', 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

insert into public.product_inventory (product_type, quantity, organization_id, branch_id) values
  ('BRICKS', 1000, 'e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-0000000000e1');

-- ------------------------------------------------------------------
-- Structural guard: every tenant table has the wall plus an admin policy
-- ------------------------------------------------------------------
select is(
  (select count(*) from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'branch_id' and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('user_branch_access', 'branch_billing_events')
     and not exists (select 1 from pg_policies p
                     where p.schemaname = 'public' and p.tablename = c.relname
                       and p.policyname = 'admin_all' and p.permissive = 'PERMISSIVE')),
  0::bigint, 'every tenant table has a permissive admin_all policy');

select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and policyname = 'tenant_isolation' and permissive <> 'RESTRICTIVE'),
  0::bigint, 'tenant_isolation is restrictive everywhere, so no role policy can widen the wall');

-- ------------------------------------------------------------------
-- uAdmin: unchanged, full access inside the branch
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-0000000000e1","role":"authenticated","organization_id":"e0000000-0000-0000-0000-00000000000e","default_branch_id":"e1000000-0000-0000-0000-0000000000e1"}';
set local role authenticated;

select is((select count(*) from public.salary_ledger), 1::bigint, 'admin reads salary_ledger');
select is((select count(*) from public.loans), 1::bigint, 'admin reads loans');
select is((select count(*) from public.accounts), 1::bigint, 'admin reads accounts');
select is((select count(*) from public.employees), 2::bigint, 'admin reads employees');
select lives_ok($$update public.app_settings set value = '3' where key = 'LOADING_AND_UNLOADING_PRICE_PER_BRICK'$$,
  'admin edits settings');
select lives_ok($$update public.orders set final_price = 1200 where id = 'e5000000-0000-0000-0000-0000000000e1'$$,
  'admin edits an order price');
select lives_ok($$select public.increment_account_balance('e6000000-0000-0000-0000-0000000000e1', 10)$$,
  'admin changes an account balance');
select is((select public.record_loader_wage('e3000000-0000-0000-0000-0000000000e1', 50, 'admin wage')).running_balance,
  350::numeric, 'the loader wage running balance continues from the latest ledger entry');

-- ------------------------------------------------------------------
-- uEmp: active employee
-- ------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"52000000-0000-0000-0000-0000000000e2","role":"authenticated","organization_id":"e0000000-0000-0000-0000-00000000000e","default_branch_id":"e1000000-0000-0000-0000-0000000000e1"}';
set local role authenticated;

-- what they must still be able to do
select is((select count(*) from public.orders), 2::bigint, 'employee reads undelivered orders only');
select is((select count(*) from public.customers), 1::bigint, 'employee reads customers (delivery list)');
select is((select count(*) from public.materials), 1::bigint, 'employee reads materials');
select is((select count(*) from public.app_settings), 1::bigint, 'employee reads app settings');
select is(jsonb_array_length(public.get_delivery_staff()), 1, 'employee gets the active delivery staff');
select is((public.get_delivery_staff() -> 0 -> 'roles' ->> 'salary_value')::numeric, 500::numeric,
  'the delivery staff list carries the pay rate the wage split needs');
select is((public.get_delivery_staff() -> 0) ? 'aadhar', false, 'the delivery staff list does not carry aadhar');
select is(public.am_i_active_employee(), true, 'employee is recognised as active');
select lives_ok($$select public.complete_delivery('e5000000-0000-0000-0000-0000000000e1', '10:00', 90, 'Site', 'PARTIALLY_PAID', 100, null, 'DC1', 'LOADING_UNLOADING', array['e3000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'employee records a delivery');
select throws_ok($$select public.complete_delivery('e5000000-0000-0000-0000-0000000000e1', '10:00', 90, 'Site', 'PARTIALLY_PAID', 100, null, 'DC1', 'LOADING_UNLOADING', array[]::uuid[])$$,
  '22023', 'This order is already delivered', 'a delivered order cannot be delivered twice');
-- production goes through the function (employees cannot write the stock tables directly)
select lives_ok($$select public.record_production_entry(current_date, 2, 100, 0, 0, 0, 5, 0)$$,
  'employee records a production entry through the function');
select is((select quantity from public.product_inventory), 1010,
  'the production entry added its bricks to stock (1000 - 90 delivered + 100)');
select is((select quantity from public.inventory_stock), -10::numeric,
  'the production entry took the raw material it used out of stock (5 kg fly ash x 2 rounds)');
select lives_ok($$insert into public.procurements (material_id, quantity, rate_per_unit, total_price, date, approved, created_by)
                   values ('ea000000-0000-0000-0000-0000000000e1', 10, 0, 0, current_date, false, (select auth.uid()))$$,
  'employee records a material purchase');
select is((select (public.record_loader_wage('e3000000-0000-0000-0000-0000000000e1', 20, 'delivery')).running_balance),
  370::numeric, 'employee credits a loader wage');

-- what they must not be able to do
select is((select count(*) from public.salary_ledger), 0::bigint, 'employee cannot read salary_ledger');
select is((select public.get_financial_summary() ->> 'total_receivables'), '0', 'employee cannot learn what customers owe through the summary RPC');
select is((select count(*) from public.customer_financials where outstanding_amount > 0), 0::bigint, 'employee cannot learn what customers owe through the views');
select is((select count(*) from public.loans), 0::bigint, 'employee cannot read loans');
select is((select count(*) from public.accounts), 0::bigint, 'employee cannot read accounts');
select is((select count(*) from public.employees), 0::bigint, 'employee cannot read employee records (aadhar, addresses)');
select is((select count(*) from public.roles), 0::bigint, 'employee cannot read pay rates directly');
update public.app_settings set value = '9';
select is((select count(*) from public.app_settings where value = '9'),
  0::bigint, 'employee cannot edit settings (the update matches no rows)');
update public.orders set final_price = 1 where id = 'e5000000-0000-0000-0000-0000000000e3';
reset role;
select is((select final_price from public.orders where id = 'e5000000-0000-0000-0000-0000000000e3'),
  1000::numeric, 'employee cannot edit an order directly');
set local role authenticated;
select throws_ok($$insert into public.order_loadmen (order_id, employee_id) values ('e5000000-0000-0000-0000-0000000000e3', 'e3000000-0000-0000-0000-0000000000e1')$$,
  '42501', null, 'employee cannot assign loadmen directly');
select throws_ok($$select public.increment_account_balance('e6000000-0000-0000-0000-0000000000e1', 10)$$,
  '42501', null, 'employee cannot change account balances');
select throws_ok($$insert into public.salary_ledger (employee_id, entry_type, amount, running_balance)
                    values ('e3000000-0000-0000-0000-0000000000e1', 'SALARY_AUTO_ENTRY', 1, 1)$$,
  '42501', null, 'employee cannot write salary_ledger directly');

-- stock can only change through record_production_entry (security_hardening)
update public.product_inventory set quantity = 1;
update public.inventory_stock set quantity = 1;
reset role;
select is((select quantity from public.product_inventory), 1010,
  'employee cannot change product stock directly (the update matches no rows)');
select is((select quantity from public.inventory_stock), -10::numeric,
  'employee cannot change material stock directly (the update matches no rows)');
set local role authenticated;
select throws_ok($$insert into public.production_entries (production_date, bricks, round) values (current_date, 100, 1)$$,
  '42501', null, 'employee cannot write production entries directly');
select throws_ok($$insert into public.inventory_stock (material_id, quantity) values ('ea000000-0000-0000-0000-0000000000e1', 5)$$,
  '42501', null, 'employee cannot insert stock rows directly');
select throws_ok($$insert into public.procurements (material_id, quantity, rate_per_unit, total_price, date, approved, created_by, total_paid, payment_status)
                    values ('ea000000-0000-0000-0000-0000000000e1', 10, 0, 0, current_date, false, (select auth.uid()), 999, 'PAID')$$,
  '42501', null, 'employee cannot submit a procurement that already looks paid');
reset role;
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename in ('inventory_stock', 'product_inventory', 'production_entries')
     and policyname in ('employee_insert', 'employee_update')),
  0::bigint, 'employees have no write policies on the stock tables');
select is(has_table_privilege('anon', 'public.accounts', 'TRUNCATE'), false, 'anon cannot truncate tables');
select is(has_table_privilege('authenticated', 'public.accounts', 'TRUNCATE'), false, 'signed-in users cannot truncate tables');
set local role authenticated;

-- ------------------------------------------------------------------
-- uOld: employee row deactivated, token still valid
-- ------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"53000000-0000-0000-0000-0000000000e3","role":"authenticated","organization_id":"e0000000-0000-0000-0000-00000000000e","default_branch_id":"e1000000-0000-0000-0000-0000000000e1"}';
set local role authenticated;

select is((select count(*) from public.orders), 0::bigint, 'a deactivated employee reads nothing');
select is(public.am_i_active_employee(), false, 'a deactivated employee is not recognised as active');
select is(jsonb_array_length(public.get_delivery_staff()), 0, 'a deactivated employee gets no staff list');
select throws_ok($$select public.record_loader_wage('e3000000-0000-0000-0000-0000000000e1', 5, 'x')$$,
  '42501', null, 'a deactivated employee cannot credit wages');

select * from finish();
rollback;
