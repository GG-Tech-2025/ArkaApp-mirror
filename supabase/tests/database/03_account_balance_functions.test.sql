-- increment/decrement_account_balance behave the same for a bad account (pgTAP).
-- Run with `supabase test db`. Everything happens in one rolled-back transaction.
--
-- Two orgs, one user each, each with one account (balance 100).

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('d1000000-0000-0000-0000-0000000000d1', 'Balance Test Org D1', 'balance-test-d1'),
  ('d2000000-0000-0000-0000-0000000000d2', 'Balance Test Org D2', 'balance-test-d2');

insert into public.branches (id, organization_id, name, code) values
  ('d1b00000-0000-0000-0000-0000000000d1', 'd1000000-0000-0000-0000-0000000000d1', 'D1', 'D1'),
  ('d2b00000-0000-0000-0000-0000000000d2', 'd2000000-0000-0000-0000-0000000000d2', 'D2', 'D2');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-0000000000d1',
   'authenticated', 'authenticated', 'balance-d1@test.invalid', '', now(), '{}', '{}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-0000000000d2',
   'authenticated', 'authenticated', 'balance-d2@test.invalid', '', now(), '{}', '{}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into public.profiles (id, phone, role, organization_id, default_branch_id) values
  ('42000000-0000-0000-0000-0000000000d1', '8200000001', 'ADMIN', 'd1000000-0000-0000-0000-0000000000d1', 'd1b00000-0000-0000-0000-0000000000d1'),
  ('42000000-0000-0000-0000-0000000000d2', '8200000002', 'ADMIN', 'd2000000-0000-0000-0000-0000000000d2', 'd2b00000-0000-0000-0000-0000000000d2');

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('42000000-0000-0000-0000-0000000000d1', 'd1b00000-0000-0000-0000-0000000000d1', 'd1000000-0000-0000-0000-0000000000d1', 'MANAGER'),
  ('42000000-0000-0000-0000-0000000000d2', 'd2b00000-0000-0000-0000-0000000000d2', 'd2000000-0000-0000-0000-0000000000d2', 'MANAGER');

insert into public.accounts (id, account_number, opening_balance, balance, organization_id, branch_id) values
  ('d1a00000-0000-0000-0000-0000000000d1', 'D1-BANK', 100, 100, 'd1000000-0000-0000-0000-0000000000d1', 'd1b00000-0000-0000-0000-0000000000d1'),
  ('d2a00000-0000-0000-0000-0000000000d2', 'D2-BANK', 100, 100, 'd2000000-0000-0000-0000-0000000000d2', 'd2b00000-0000-0000-0000-0000000000d2');

-- ------------------------------------------------------------------
-- As the org D1 user
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"42000000-0000-0000-0000-0000000000d1","role":"authenticated","organization_id":"d1000000-0000-0000-0000-0000000000d1","default_branch_id":"d1b00000-0000-0000-0000-0000000000d1"}';
set local role authenticated;

select lives_ok($$select public.increment_account_balance('d1a00000-0000-0000-0000-0000000000d1', 25)$$,
  'incrementing the user''s own account works');
select is((select balance from public.accounts where id = 'd1a00000-0000-0000-0000-0000000000d1'),
  125::numeric, 'the own account went up by the amount');

select lives_ok($$select public.decrement_account_balance('d1a00000-0000-0000-0000-0000000000d1', 5)$$,
  'decrementing the user''s own account works');
select is((select balance from public.accounts where id = 'd1a00000-0000-0000-0000-0000000000d1'),
  120::numeric, 'the own account went down by the amount');

select throws_ok($$select public.increment_account_balance('00000000-0000-0000-0000-0000000000ff', 25)$$,
  'P0001', 'Account not found', 'incrementing an account that does not exist is an error');
select throws_ok($$select public.decrement_account_balance('00000000-0000-0000-0000-0000000000ff', 25)$$,
  'P0001', 'Account not found', 'decrementing an account that does not exist is an error');

select throws_ok($$select public.increment_account_balance('d2a00000-0000-0000-0000-0000000000d2', 25)$$,
  'P0001', 'Account not found', 'incrementing another organization''s account is an error');
select throws_ok($$select public.decrement_account_balance('d2a00000-0000-0000-0000-0000000000d2', 25)$$,
  'P0001', 'Account not found', 'decrementing another organization''s account is an error');

select throws_ok($$select public.increment_account_balance(null, 25)$$,
  'P0001', 'Account not found', 'incrementing with no account id is an error');

reset role;

-- ------------------------------------------------------------------
-- The other organization's balance was never touched
-- ------------------------------------------------------------------
select is((select balance from public.accounts where id = 'd2a00000-0000-0000-0000-0000000000d2'),
  100::numeric, 'the other organization''s balance is unchanged');
select is((select balance from public.accounts where id = 'd1a00000-0000-0000-0000-0000000000d1'),
  120::numeric, 'the failed calls changed nothing in the user''s own account either');

select * from finish();
rollback;
