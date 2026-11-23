-- Inventory tests (pgTAP). Run with `supabase test db` (CI does this).
--
-- approve_procurement: approving a pending procurement adds its quantity to the material's
--   stock, converted to kg (tons x 1000, cement bags x 50, crusher powder loads x 4500).
-- create_inventory_adjustment: a stock-take records what was counted and sets stock to it.
-- Both are admin-only and stay inside the caller's branch.
--
-- Two organizations, one admin and one employee in the first. Everything happens in one
-- transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner, so RLS does not apply)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('f0000000-0000-0000-0000-00000000000a', 'Inventory Org A', 'inventory-a'),
  ('f0000000-0000-0000-0000-00000000000b', 'Inventory Org B', 'inventory-b');

insert into public.branches (id, organization_id, name, code) values
  ('f1000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-00000000000a', 'A1', 'A1'),
  ('f1000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-00000000000b', 'B1', 'B1');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '', now(), '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('61000000-0000-0000-0000-0000000000a1'::uuid, 'inv-admin@test.invalid'),
  ('62000000-0000-0000-0000-0000000000a2'::uuid, 'inv-emp@test.invalid')
) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id) values
  ('61000000-0000-0000-0000-0000000000a1', '8400000001', 'ADMIN',    'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('62000000-0000-0000-0000-0000000000a2', '8400000002', 'EMPLOYEE', 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1');

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('61000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-00000000000a', 'MANAGER'),
  ('62000000-0000-0000-0000-0000000000a2', 'f1000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-00000000000a', 'STAFF');

insert into public.materials (id, name, unit, organization_id, branch_id) values
  ('f2000000-0000-0000-0000-0000000000a1', 'Wet Ash',        'kg', 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a2', 'Cement',         'kg', 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a3', 'Crusher Powder', 'kg', 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a4', 'Fly Ash',        'kg', 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a5', 'Marble Powder',  'kg', 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000b1', 'Wet Ash',        'kg', 'f0000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-0000000000b1');

-- Fly Ash has no stock row yet: its first approval must create one.
insert into public.inventory_stock (material_id, quantity, organization_id, branch_id) values
  ('f2000000-0000-0000-0000-0000000000a1', 1000, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a2',  500, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a3', 4500, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000a5', 2000, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('f2000000-0000-0000-0000-0000000000b1',  777, 'f0000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-0000000000b1');

insert into public.product_inventory (product_type, quantity, organization_id, branch_id) values
  ('BRICKS', 1000, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'),
  ('BRICKS',    5, 'f0000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-0000000000b1');

insert into public.procurements (id, material_id, quantity, rate_per_unit, total_price, date, approved, organization_id, branch_id) values
  ('f3000000-0000-0000-0000-0000000000a1', 'f2000000-0000-0000-0000-0000000000a1',  30, 0, 0, current_date, false, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'), -- wet ash, tons
  ('f3000000-0000-0000-0000-0000000000a2', 'f2000000-0000-0000-0000-0000000000a2', 200, 0, 0, current_date, false, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'), -- cement, bags
  ('f3000000-0000-0000-0000-0000000000a3', 'f2000000-0000-0000-0000-0000000000a3',   3, 0, 0, current_date, false, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'), -- crusher powder, loads
  ('f3000000-0000-0000-0000-0000000000a4', 'f2000000-0000-0000-0000-0000000000a4',   2, 0, 0, current_date, false, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'), -- fly ash, tons (no stock row yet)
  ('f3000000-0000-0000-0000-0000000000a5', 'f2000000-0000-0000-0000-0000000000a5',   5, 0, 0, current_date, false, 'f0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000a1'), -- marble powder, stays pending
  ('f3000000-0000-0000-0000-0000000000b1', 'f2000000-0000-0000-0000-0000000000b1',  10, 0, 0, current_date, false, 'f0000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-0000000000b1'); -- another organization's

-- ------------------------------------------------------------------
-- Admin: approving procurements
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"61000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"f0000000-0000-0000-0000-00000000000a","default_branch_id":"f1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select lives_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a1', 900, 27000)$$,
  'admin approves a wet ash procurement');
select is((select approved from public.procurements where id = 'f3000000-0000-0000-0000-0000000000a1'), true,
  'the procurement is marked approved');
select is((select rate_per_unit || '/' || total_price from public.procurements where id = 'f3000000-0000-0000-0000-0000000000a1'), '900/27000',
  'the approved rate and total are stored');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a1'), 31000::numeric,
  'wet ash: 30 tons add 30,000 kg to the 1,000 kg already there');

select lives_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a2', 380, 76000)$$,
  'admin approves a cement procurement');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a2'), 10500::numeric,
  'cement: 200 bags add 10,000 kg (50 kg a bag) to the 500 kg already there');

select lives_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a3', 3200, 9600)$$,
  'admin approves a crusher powder procurement');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a3'), 18000::numeric,
  'crusher powder: 3 loads add 13,500 kg (4,500 kg a load) to the 4,500 kg already there');

select lives_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a4', 1100, 2200)$$,
  'admin approves a procurement for a material with no stock row yet');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a4'), 2000::numeric,
  'fly ash: the first approval creates the stock row with 2 tons = 2,000 kg');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a5'), 2000::numeric,
  'a material that was not approved keeps its stock');

select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a1', 900, 27000)$$,
  '22023', 'This procurement is already approved', 'a procurement cannot be approved twice');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a1'), 31000::numeric,
  'the second attempt added nothing to the stock');

select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a5', -1, 100)$$,
  '22023', 'Rate and total price cannot be negative', 'a negative rate is refused');
select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a5', 100, -1)$$,
  '22023', 'Rate and total price cannot be negative', 'a negative total is refused');
select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a5', null, 100)$$,
  '22023', 'Rate and total price cannot be negative', 'a missing rate is refused');
select is((select approved from public.procurements where id = 'f3000000-0000-0000-0000-0000000000a5'), false,
  'a refused approval leaves the procurement pending');

select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-00000000dead', 1, 1)$$,
  'P0002', 'Procurement not found', 'an unknown procurement is refused');
select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000b1', 1, 1)$$,
  'P0002', 'Procurement not found', 'another organization''s procurement cannot be approved');

-- ------------------------------------------------------------------
-- Employee: cannot approve
-- ------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"f0000000-0000-0000-0000-00000000000a","default_branch_id":"f1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select throws_ok($$select public.approve_procurement('f3000000-0000-0000-0000-0000000000a5', 1, 5)$$,
  '42501', 'Only administrators can approve procurements', 'an employee cannot approve a procurement');

reset role;
select is((select approved from public.procurements where id = 'f3000000-0000-0000-0000-0000000000a5'), false,
  'the employee''s attempt left the procurement pending');
select is((select approved from public.procurements where id = 'f3000000-0000-0000-0000-0000000000b1'), false,
  'the other organization''s procurement was never touched');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000b1'), 777::numeric,
  'the other organization''s stock was never touched');

-- ------------------------------------------------------------------
-- Admin: inventory adjustments (a stock-take)
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"61000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"f0000000-0000-0000-0000-00000000000a","default_branch_id":"f1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select lives_ok($$select public.create_inventory_adjustment(
    '2026-10-15',
    1000, 31000, 2000, 18000, 2000, 210,   -- what the system had
    950, 30000, 1500, null, 1800, 40,      -- what was counted (crusher powder not counted)
    'Recount after the rain')$$,
  'admin records an adjustment');
select is((select count(*) from public.inventory_adjustments), 1::bigint, 'the adjustment is saved');
select is((select actual_bricks || '/' || adjusted_bricks || '/' || actual_wet_ash_kg || '/' || adjusted_wet_ash_kg || '/' || actual_cement_bags || '/' || adjusted_cement_bags
           from public.inventory_adjustments),
  '1000/950/31000/30000/210/40', 'the counted and the corrected figures are both kept');
select is((select reason from public.inventory_adjustments), 'Recount after the rain', 'the reason is kept');
select is((select created_by from public.inventory_adjustments), '61000000-0000-0000-0000-0000000000a1'::uuid,
  'the adjustment records who made it');
select is((select quantity from public.product_inventory where product_type = 'BRICKS'), 950,
  'bricks ready is set to the corrected figure');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a1'), 30000::numeric,
  'wet ash is set to the corrected figure, not added to');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a5'), 1500::numeric,
  'marble powder is set to the corrected figure');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a2'), 2000::numeric,
  'cement is entered in bags and stored in kg: 40 bags = 2,000 kg');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a3'), 18000::numeric,
  'a material with no corrected figure keeps its stock');
select is((select quantity from public.inventory_stock where material_id = 'f2000000-0000-0000-0000-0000000000a4'), 1800::numeric,
  'fly ash is set to the corrected figure');

select lives_ok($$select public.create_inventory_adjustment('2026-10-16', 950, 30000, 1500, 18000, 1800, 40, null, null, null, null, null, null, null)$$,
  'an adjustment with nothing corrected and no reason is accepted');
select is((select quantity from public.product_inventory where product_type = 'BRICKS'), 950,
  'no corrected bricks figure leaves bricks ready as it was');

reset role;
select is((select quantity from public.product_inventory where branch_id = 'f1000000-0000-0000-0000-0000000000b1'), 5,
  'the other organization''s bricks were never touched');

-- ------------------------------------------------------------------
-- Employee and anonymous callers
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"f0000000-0000-0000-0000-00000000000a","default_branch_id":"f1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select throws_ok($$select public.create_inventory_adjustment('2026-10-17', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'x')$$,
  '42501', 'Only administrators can adjust inventory', 'an employee cannot adjust inventory');
reset role;
select is((select count(*) from public.inventory_adjustments where organization_id = 'f0000000-0000-0000-0000-00000000000a'), 2::bigint,
  'the employee''s attempt saved nothing (only the admin''s two adjustments exist)');

select is(has_function_privilege('anon', 'public.approve_procurement(uuid, numeric, numeric)', 'execute'), false,
  'a signed-out caller cannot approve procurements');
select is(has_function_privilege('anon', 'public.create_inventory_adjustment(date, integer, numeric, numeric, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, text)', 'execute'), false,
  'a signed-out caller cannot adjust inventory');

select * from finish();
rollback;
