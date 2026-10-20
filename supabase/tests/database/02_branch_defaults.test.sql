-- Branch defaults, per-branch cash account and cash-summary start date (pgTAP).
-- Run with `supabase test db`. Everything happens in one rolled-back transaction.
--
-- Org C has three branches and one user with access to all of them:
--   C1, C2: seeded with seed_branch_defaults        C3: never seeded (no settings)

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('c0000000-0000-0000-0000-00000000000c', 'Defaults Test Org C', 'defaults-test-c');

insert into public.branches (id, organization_id, name, code) values
  ('c1000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-00000000000c', 'C1', 'C1'),
  ('c2000000-0000-0000-0000-0000000000c2', 'c0000000-0000-0000-0000-00000000000c', 'C2', 'C2'),
  ('c3000000-0000-0000-0000-0000000000c3', 'c0000000-0000-0000-0000-00000000000c', 'C3', 'C3');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', '41000000-0000-0000-0000-0000000000c1',
  'authenticated', 'authenticated', 'defaults-uc@test.invalid', '', now(), '{}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, phone, role, organization_id, default_branch_id) values
  ('41000000-0000-0000-0000-0000000000c1', '8100000001', 'ADMIN', 'c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-0000000000c1');

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('41000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-00000000000c', 'MANAGER'),
  ('41000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c2', 'c0000000-0000-0000-0000-00000000000c', 'MANAGER'),
  ('41000000-0000-0000-0000-0000000000c1', 'c3000000-0000-0000-0000-0000000000c3', 'c0000000-0000-0000-0000-00000000000c', 'MANAGER');

-- ------------------------------------------------------------------
-- seed_branch_defaults
-- ------------------------------------------------------------------
select lives_ok($$select public.seed_branch_defaults('c1000000-0000-0000-0000-0000000000c1')$$, 'a branch can be seeded');

select is((select count(*) from public.accounts where branch_id = 'c1000000-0000-0000-0000-0000000000c1' and is_cash),
  1::bigint, 'seeding creates the branch''s cash account');
select is((select count(*) from public.app_settings where branch_id = 'c1000000-0000-0000-0000-0000000000c1'),
  2::bigint, 'seeding creates the two settings the app reads');
select is((select value from public.app_settings where branch_id = 'c1000000-0000-0000-0000-0000000000c1' and key = 'LOADING_AND_UNLOADING_PRICE_PER_BRICK'),
  '0', 'the loading price is seeded as 0 so someone must set the real value');
select matches((select value from public.app_settings where branch_id = 'c1000000-0000-0000-0000-0000000000c1' and key = 'APP_START_DATE'),
  '^\d{4}-\d{2}-\d{2}$', 'APP_START_DATE is seeded as a date');
select is((select array_agg(name order by name) from public.materials where branch_id = 'c1000000-0000-0000-0000-0000000000c1'),
  array['Cement', 'Crusher Powder', 'Fly Ash', 'Marble Powder', 'Wet Ash'],
  'seeding creates the five materials the production logic looks up by name');
select is(
  (select count(*) from (
     select organization_id from public.accounts where branch_id = 'c1000000-0000-0000-0000-0000000000c1'
     union all select organization_id from public.app_settings where branch_id = 'c1000000-0000-0000-0000-0000000000c1'
     union all select organization_id from public.materials where branch_id = 'c1000000-0000-0000-0000-0000000000c1'
   ) r where organization_id <> 'c0000000-0000-0000-0000-00000000000c'),
  0::bigint, 'every seeded row carries the branch''s organization');

select public.seed_branch_defaults('c1000000-0000-0000-0000-0000000000c1');
select is(
  (select (select count(*) from public.accounts where branch_id = 'c1000000-0000-0000-0000-0000000000c1')
       || '/' || (select count(*) from public.app_settings where branch_id = 'c1000000-0000-0000-0000-0000000000c1')
       || '/' || (select count(*) from public.materials where branch_id = 'c1000000-0000-0000-0000-0000000000c1')),
  '1/2/5', 'seeding twice creates nothing extra');

select throws_ok($$select public.seed_branch_defaults('00000000-0000-0000-0000-0000000000ff')$$,
  'P0002', null, 'seeding an unknown branch is an error');

select lives_ok($$select public.seed_branch_defaults('c2000000-0000-0000-0000-0000000000c2')$$, 'a second branch can be seeded');

-- ------------------------------------------------------------------
-- One cash account per branch; one BRICKS row per branch
-- ------------------------------------------------------------------
select throws_ok(
  $$insert into public.accounts (account_number, is_cash, organization_id, branch_id)
    values ('Cash 2', true, 'c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-0000000000c1')$$,
  '23505', null, 'a branch cannot have a second cash account');
select is((select count(*) from public.accounts where is_cash and organization_id = 'c0000000-0000-0000-0000-00000000000c'),
  2::bigint, 'each branch has its own cash account');
select lives_ok(
  $$insert into public.accounts (account_number, is_cash, organization_id, branch_id) values
      ('Bank 1', false, 'c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-0000000000c1'),
      ('Bank 2', false, 'c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-0000000000c1')$$,
  'a branch can have any number of bank accounts');

select lives_ok(
  $$insert into public.product_inventory (organization_id, branch_id)
    values ('c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-0000000000c1')$$,
  'a branch can have a BRICKS stock row');
select throws_ok(
  $$insert into public.product_inventory (organization_id, branch_id)
    values ('c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-0000000000c1')$$,
  '23505', null, 'a branch cannot have a second BRICKS stock row');
select lives_ok(
  $$insert into public.product_inventory (organization_id, branch_id)
    values ('c0000000-0000-0000-0000-00000000000c', 'c2000000-0000-0000-0000-0000000000c2')$$,
  'another branch has its own BRICKS stock row');

-- ------------------------------------------------------------------
-- Who may run the seeding function
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-0000000000c1","role":"authenticated","organization_id":"c0000000-0000-0000-0000-00000000000c","default_branch_id":"c1000000-0000-0000-0000-0000000000c1"}';
set local role authenticated;
select throws_ok($$select public.seed_branch_defaults('c3000000-0000-0000-0000-0000000000c3')$$,
  '42501', null, 'a signed-in user cannot seed a branch');
reset role;

set local request.jwt.claims = '';
set local role anon;
select throws_ok($$select public.seed_branch_defaults('c3000000-0000-0000-0000-0000000000c3')$$,
  '42501', null, 'anon cannot seed a branch');
reset role;

-- ------------------------------------------------------------------
-- Cash summary starts at the active branch's own go-live date
-- ------------------------------------------------------------------
-- (the function's "today" is India time, so the setup uses the same expression)
update public.app_settings set value = to_char((timezone('Asia/Kolkata', now()))::date - 4, 'YYYY-MM-DD')
  where branch_id = 'c1000000-0000-0000-0000-0000000000c1' and key = 'APP_START_DATE';
update public.app_settings set value = to_char((timezone('Asia/Kolkata', now()))::date - 9, 'YYYY-MM-DD')
  where branch_id = 'c2000000-0000-0000-0000-0000000000c2' and key = 'APP_START_DATE';

set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-0000000000c1","role":"authenticated","organization_id":"c0000000-0000-0000-0000-00000000000c","default_branch_id":"c1000000-0000-0000-0000-0000000000c1"}';
set local role authenticated;

select is((select array_agg(branch_id) from public.accounts where is_cash),
  array['c1000000-0000-0000-0000-0000000000c1']::uuid[], 'a user sees only the active branch''s cash account');
select is((select public.get_daily_cash_summary() ->> 'total_days'), '5', 'branch C1 (started 4 days ago) has 5 days');
select is((select json_array_length(public.get_daily_cash_summary() -> 'data')), 5, 'branch C1 lists exactly its 5 days');
select is((select public.get_daily_cash_summary() ->> 'has_more'), 'false', 'branch C1 has no further pages');
reset role;

set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-0000000000c1","role":"authenticated","organization_id":"c0000000-0000-0000-0000-00000000000c","default_branch_id":"c2000000-0000-0000-0000-0000000000c2"}';
set local role authenticated;
select is((select public.get_daily_cash_summary() ->> 'total_days'), '10', 'branch C2 (started 9 days ago) has 10 days');
reset role;

set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-0000000000c1","role":"authenticated","organization_id":"c0000000-0000-0000-0000-00000000000c","default_branch_id":"c3000000-0000-0000-0000-0000000000c3"}';
set local role authenticated;
select is((select public.get_daily_cash_summary() ->> 'total_days'),
  ((timezone('Asia/Kolkata', now()))::date - date_trunc('year', (timezone('Asia/Kolkata', now()))::date)::date + 1)::text,
  'a branch with no APP_START_DATE falls back to the start of the year');
reset role;

update public.app_settings set value = 'not-a-date'
  where branch_id = 'c2000000-0000-0000-0000-0000000000c2' and key = 'APP_START_DATE';
set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-0000000000c1","role":"authenticated","organization_id":"c0000000-0000-0000-0000-00000000000c","default_branch_id":"c2000000-0000-0000-0000-0000000000c2"}';
set local role authenticated;
select is((select public.get_daily_cash_summary() ->> 'total_days'),
  ((timezone('Asia/Kolkata', now()))::date - date_trunc('year', (timezone('Asia/Kolkata', now()))::date)::date + 1)::text,
  'a malformed APP_START_DATE falls back to the start of the year instead of failing');
reset role;

select * from finish();
rollback;
