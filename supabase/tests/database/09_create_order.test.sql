-- create_order tests (pgTAP). Run with `supabase test db` (CI does this).
--
-- One organization, one branch, an administrator and an employee. The administrator creates
-- orders through create_order and the load type has to come out the other side.
-- Everything happens in one transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner, so RLS does not apply)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('f0000000-0000-0000-0000-00000000000f', 'Create Order Org', 'create-order-f');

insert into public.branches (id, organization_id, name, code) values
  ('f1000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-00000000000f', 'F1', 'F1');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '', now(), '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('61000000-0000-0000-0000-0000000000f1'::uuid, 'order-admin@test.invalid'),
  ('62000000-0000-0000-0000-0000000000f2'::uuid, 'order-emp@test.invalid')
) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id) values
  ('61000000-0000-0000-0000-0000000000f1', '8400000001', 'ADMIN',    'f0000000-0000-0000-0000-00000000000f', 'f1000000-0000-0000-0000-0000000000f1'),
  ('62000000-0000-0000-0000-0000000000f2', '8400000002', 'EMPLOYEE', 'f0000000-0000-0000-0000-00000000000f', 'f1000000-0000-0000-0000-0000000000f1');

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('61000000-0000-0000-0000-0000000000f1', 'f1000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-00000000000f', 'MANAGER'),
  ('62000000-0000-0000-0000-0000000000f2', 'f1000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-00000000000f', 'STAFF');

insert into public.customers (id, name, phone, organization_id, branch_id) values
  ('f4000000-0000-0000-0000-0000000000f1', 'Cust F', '9400000001', 'f0000000-0000-0000-0000-00000000000f', 'f1000000-0000-0000-0000-0000000000f1');

-- ------------------------------------------------------------------
-- The administrator creates orders; each uses its own brick quantity so it can be found again
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"61000000-0000-0000-0000-0000000000f1","role":"authenticated","organization_id":"f0000000-0000-0000-0000-00000000000f","default_branch_id":"f1000000-0000-0000-0000-0000000000f1"}';
set local role authenticated;

select lives_ok($$select public.create_order(
  '{"customer_id":"f4000000-0000-0000-0000-0000000000f1","order_date":"2026-10-01","delivery_date":"2026-10-05","brick_quantity":101,"final_price":1000,"location":"Site","loading_type":"LOADING_ONLY"}'::jsonb)$$,
  'creating an order with a load type works');
select is((select loading_type from public.orders where brick_quantity = 101), 'LOADING_ONLY',
  'the load type from the payload is stored');

select public.create_order(
  '{"customer_id":"f4000000-0000-0000-0000-0000000000f1","order_date":"2026-10-01","delivery_date":"2026-10-05","brick_quantity":102,"final_price":1000,"location":"Site","loading_type":"CUSTOMER_SELF"}'::jsonb);
select is((select loading_type from public.orders where brick_quantity = 102), 'CUSTOMER_SELF',
  'Customer Self is stored as it was sent');

select public.create_order(
  '{"customer_id":"f4000000-0000-0000-0000-0000000000f1","order_date":"2026-10-01","delivery_date":"2026-10-05","brick_quantity":103,"final_price":1000,"location":"Site"}'::jsonb);
select is((select loading_type from public.orders where brick_quantity = 103), 'LOADING_UNLOADING',
  'an order sent without a load type is stored as Loading and Unloading');

select public.create_order(
  '{"customer_id":"f4000000-0000-0000-0000-0000000000f1","order_date":"2026-10-01","delivery_date":"2026-10-05","brick_quantity":104,"final_price":1000,"location":"Site","loading_type":null}'::jsonb);
select is((select loading_type from public.orders where brick_quantity = 104), 'LOADING_UNLOADING',
  'an order sent with a null load type is stored as Loading and Unloading');

select throws_ok($$select public.create_order(
  '{"customer_id":"f4000000-0000-0000-0000-0000000000f1","order_date":"2026-10-01","delivery_date":"2026-10-05","brick_quantity":105,"final_price":1000,"location":"Site","loading_type":"BY_HAND"}'::jsonb)$$,
  '23514', null, 'a load type that does not exist is rejected');

select is((select count(*) from public.orders where loading_type is null), 0::bigint,
  'every order created here has a load type');

-- ------------------------------------------------------------------
-- An employee cannot create orders
-- ------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-0000000000f2","role":"authenticated","organization_id":"f0000000-0000-0000-0000-00000000000f","default_branch_id":"f1000000-0000-0000-0000-0000000000f1"}';
set local role authenticated;

select throws_ok($$select public.create_order(
  '{"customer_id":"f4000000-0000-0000-0000-0000000000f1","order_date":"2026-10-01","delivery_date":"2026-10-05","brick_quantity":106,"final_price":1000,"location":"Site","loading_type":"LOADING_ONLY"}'::jsonb)$$,
  '42501', null, 'an employee cannot create an order');

select * from finish();
rollback;
