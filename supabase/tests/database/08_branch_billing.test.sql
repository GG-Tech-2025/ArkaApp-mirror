-- Manual branch billing and pausing (pgTAP).
-- Run with `supabase test db`. Everything happens in one rolled-back transaction.
--
-- Org P1 has two branches (PB1, PB2); org P2 has PB3; org P3 is cancelled.
--   SA  platform super-admin      A1  admin of P1 (both branches)    A2  admin of P2
--   EMP an active employee login in PB1 (their employees row matches by phone)

begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into public.organizations (id, name, slug) values
  ('5b000000-0000-0000-0000-0000000000a1', 'Billing Test Org P1', 'billing-test-p1'),
  ('5b000000-0000-0000-0000-0000000000a2', 'Billing Test Org P2', 'billing-test-p2');
insert into public.organizations (id, name, slug, status) values
  ('5b000000-0000-0000-0000-0000000000a3', 'Billing Test Org P3', 'billing-test-p3', 'CANCELLED');

insert into public.branches (id, organization_id, name, code, renewal_date) values
  ('5bb00000-0000-0000-0000-0000000000b1', '5b000000-0000-0000-0000-0000000000a1', 'PB1', 'PB1', current_date + 10),
  ('5bb00000-0000-0000-0000-0000000000b2', '5b000000-0000-0000-0000-0000000000a1', 'PB2', 'PB2', current_date + 20),
  ('5bb00000-0000-0000-0000-0000000000b3', '5b000000-0000-0000-0000-0000000000a2', 'PB3', 'PB3', current_date + 30);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
         '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
  from (values
    ('5bc00000-0000-0000-0000-0000000000a0'::uuid, 'bl-sa@test.invalid'),
    ('5bc00000-0000-0000-0000-0000000000a1'::uuid, 'bl-a1@test.invalid'),
    ('5bc00000-0000-0000-0000-0000000000a2'::uuid, 'bl-a2@test.invalid'),
    ('5bc00000-0000-0000-0000-0000000000e1'::uuid, 'bl-emp@test.invalid')
  ) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id, is_super_admin) values
  ('5bc00000-0000-0000-0000-0000000000a0', '8700000000', 'ADMIN', null, null, true),
  ('5bc00000-0000-0000-0000-0000000000a1', '8700000100', 'ADMIN', '5b000000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b1', false),
  ('5bc00000-0000-0000-0000-0000000000a2', '8700000101', 'ADMIN', '5b000000-0000-0000-0000-0000000000a2', '5bb00000-0000-0000-0000-0000000000b3', false),
  ('5bc00000-0000-0000-0000-0000000000e1', '8700000001', 'EMPLOYEE', '5b000000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b1', false);
insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('5bc00000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b1', '5b000000-0000-0000-0000-0000000000a1', 'MANAGER'),
  ('5bc00000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b2', '5b000000-0000-0000-0000-0000000000a1', 'MANAGER'),
  ('5bc00000-0000-0000-0000-0000000000a2', '5bb00000-0000-0000-0000-0000000000b3', '5b000000-0000-0000-0000-0000000000a2', 'MANAGER'),
  ('5bc00000-0000-0000-0000-0000000000e1', '5bb00000-0000-0000-0000-0000000000b1', '5b000000-0000-0000-0000-0000000000a1', 'STAFF');
insert into public.employees (name, phone, active, organization_id, branch_id)
values ('Billing Emp', '8700000001', true, '5b000000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b1');

insert into public.accounts (account_number, opening_balance, balance, organization_id, branch_id) values
  ('P1-A', 1, 1, '5b000000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b1'),
  ('P2-A', 1, 1, '5b000000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b2'),
  ('P3-A', 1, 1, '5b000000-0000-0000-0000-0000000000a2', '5bb00000-0000-0000-0000-0000000000b3');

-- ------------------------------------------------------------------
-- Before any pause: everything works
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b1"}';
set local role authenticated;
select is((select array_agg(account_number) from public.accounts), array['P1-A'], 'an active branch works normally');
select is((select renewal_date from public.branches where id = '5bb00000-0000-0000-0000-0000000000b2'), current_date + 20,
  'a client admin can see their own branch''s renewal date (the app shows a reminder from it)');
select is((select count(*) from public.branch_billing_events), 0::bigint, 'but cannot read the billing history');
select throws_ok($$insert into public.branch_billing_events (organization_id, branch_id, event_type) values ('5b000000-0000-0000-0000-0000000000a1', '5bb00000-0000-0000-0000-0000000000b1', 'PAYMENT')$$,
  '42501', null, 'nor write to it');
reset role;

-- ------------------------------------------------------------------
-- Only the platform operator may use the billing functions
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b1"}';
set local role authenticated;
select throws_ok($$select public.platform_set_branch_status('5bb00000-0000-0000-0000-0000000000b1', false)$$, '42501', null, 'a client admin cannot pause a branch (not even their own)');
select throws_ok($$select public.platform_record_payment('5bb00000-0000-0000-0000-0000000000b1', current_date, current_date + 30)$$, '42501', null, 'a client admin cannot record a payment');
select throws_ok($$select public.platform_set_renewal_date('5bb00000-0000-0000-0000-0000000000b1', current_date + 99)$$, '42501', null, 'a client admin cannot move their own renewal date');
select throws_ok($$select public.platform_set_org_status('5b000000-0000-0000-0000-0000000000a1', false)$$, '42501', null, 'a client admin cannot suspend an organization');
select throws_ok($$select * from public.platform_list_org_admins('5b000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'a client admin cannot list admins (and their emails)');
reset role;
set local request.jwt.claims = '';
set local role anon;
select throws_ok($$select public.platform_set_branch_status('5bb00000-0000-0000-0000-0000000000b1', false)$$, '42501', null, 'anon cannot pause a branch');
reset role;

-- ------------------------------------------------------------------
-- Pausing a branch, as the super-admin
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select is((select public.platform_set_branch_status('5bb00000-0000-0000-0000-0000000000b1', false, '  March fee unpaid  ')), 'INACTIVE', 'the super-admin pauses a branch');
select is((select public.platform_set_branch_status('5bb00000-0000-0000-0000-0000000000b1', false)), 'INACTIVE', 'pausing it again changes nothing');
reset role;
select is((select count(*) from public.branch_billing_events where branch_id = '5bb00000-0000-0000-0000-0000000000b1' and event_type = 'PAUSED'), 1::bigint,
  'and is not logged twice');
select is((select note || '/' || (actor_id = '5bc00000-0000-0000-0000-0000000000a0')::text from public.branch_billing_events where branch_id = '5bb00000-0000-0000-0000-0000000000b1' and event_type = 'PAUSED'),
  'March fee unpaid/true', 'the pause is logged with its (trimmed) reason and who did it');

-- the same signed-in admin, with the SAME token, is locked out at once
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b1"}';
set local role authenticated;
select is((select count(*) from public.accounts), 0::bigint, 'the paused branch''s admin, with the token they already had, now sees nothing');
select throws_ok($$insert into public.accounts (account_number) values ('sneaky')$$, '42501', null, 'and cannot write anything');
select is((select array_agg(code || ':' || status order by code) from public.branches), array['PB1:INACTIVE', 'PB2:ACTIVE'],
  'but can still see the branch list, so the app can say which branch is paused');
select throws_ok($$select public.set_active_branch('5bb00000-0000-0000-0000-0000000000b1')$$, '55000', 'That branch is paused. Please contact support',
  'and cannot switch (back) to the paused branch');
select is((select public.get_delivery_staff()), '[]'::jsonb, 'the delivery staff function returns nothing for a paused branch');
reset role;

-- the same client's other branch is unaffected
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b2"}';
set local role authenticated;
select is((select array_agg(account_number) from public.accounts), array['P2-A'], 'the same client''s other branch keeps working');
select lives_ok($$select public.set_active_branch('5bb00000-0000-0000-0000-0000000000b2')$$, 'and the admin can switch to it');
reset role;

-- employees of the paused branch are locked out too
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000e1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b1"}';
set local role authenticated;
select is((select public.am_i_active_employee()), false, 'an employee of the paused branch is no longer an active employee');
reset role;

-- another client is untouched
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a2","default_branch_id":"5bb00000-0000-0000-0000-0000000000b3"}';
set local role authenticated;
select is((select array_agg(account_number) from public.accounts), array['P3-A'], 'another client is not affected');
reset role;

-- ------------------------------------------------------------------
-- Recording a payment resumes the branch
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select is((select public.platform_record_payment('5bb00000-0000-0000-0000-0000000000b1', current_date, current_date + 30, 5000.50, ' UPI-123 ', 'March', true) ->> 'status'),
  'ACTIVE', 'recording a payment on a paused branch resumes it');
reset role;
select is((select last_payment_date || '/' || renewal_date from public.branches where id = '5bb00000-0000-0000-0000-0000000000b1'),
  current_date::text || '/' || (current_date + 30)::text, 'and sets the last payment date and the new renewal date');
select is((select amount || '/' || reference || '/' || renewal_date_after from public.branch_billing_events where branch_id = '5bb00000-0000-0000-0000-0000000000b1' and event_type = 'PAYMENT'),
  '5000.50/UPI-123/' || (current_date + 30)::text, 'the payment is logged with its amount, trimmed reference and the renewal date it set');
select is((select count(*) from public.branch_billing_events where branch_id = '5bb00000-0000-0000-0000-0000000000b1' and event_type = 'RESUMED'), 1::bigint,
  'and the resume is logged');

set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b1"}';
set local role authenticated;
select is((select array_agg(account_number) from public.accounts), array['P1-A'], 'the admin''s existing token works again immediately');
reset role;
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000e1","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a1","default_branch_id":"5bb00000-0000-0000-0000-0000000000b1"}';
set local role authenticated;
select is((select public.am_i_active_employee()), true, 'and the employee is active again');
reset role;

-- ------------------------------------------------------------------
-- Dates, renewals and refusals
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select lives_ok($$select public.platform_record_payment('5bb00000-0000-0000-0000-0000000000b1', current_date - 10, current_date + 60)$$,
  'an older payment can be entered afterwards');
reset role;
select is((select last_payment_date from public.branches where id = '5bb00000-0000-0000-0000-0000000000b1'), current_date,
  'the last payment date never moves backwards');
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select is((select public.platform_set_renewal_date('5bb00000-0000-0000-0000-0000000000b1', current_date + 45, 'goodwill extension')), current_date + 45,
  'the renewal date can be changed on its own');
reset role;
select is((select note || '/' || renewal_date_after from public.branch_billing_events where branch_id = '5bb00000-0000-0000-0000-0000000000b1' and event_type = 'RENEWAL_CHANGED'),
  'goodwill extension/' || (current_date + 45)::text, 'and is logged with its reason');

set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select throws_ok($$select public.platform_record_payment('5bb00000-0000-0000-0000-0000000000b1', current_date + 2, current_date + 40)$$, '22023', null, 'a payment dated in the future is refused');
select throws_ok($$select public.platform_record_payment('5bb00000-0000-0000-0000-0000000000b1', current_date, current_date)$$, '22023', null, 'a renewal date not after the payment date is refused');
select throws_ok($$select public.platform_record_payment('5bb00000-0000-0000-0000-0000000000b1', current_date, current_date + 30, -5)$$, '22023', null, 'a negative amount is refused');
select throws_ok($$select public.platform_record_payment('00000000-0000-0000-0000-0000000000ff', current_date, current_date + 30)$$, 'P0002', 'Branch not found', 'a branch that does not exist is refused');
reset role;

-- ------------------------------------------------------------------
-- Pausing a whole client, and who can read the log
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select is((select public.platform_set_org_status('5b000000-0000-0000-0000-0000000000a2', false, 'contract ended')), 'SUSPENDED', 'the super-admin can suspend a whole client');
select throws_ok($$select public.platform_set_org_status('5b000000-0000-0000-0000-0000000000a3', true)$$, '55000', null, 'a cancelled client cannot be changed here');
select ok((select count(*) from public.branch_billing_events) >= 5, 'the super-admin can read the billing history');
select is((select email from public.platform_list_org_admins('5b000000-0000-0000-0000-0000000000a1')), 'bl-a1@test.invalid', 'and a client''s admins with their emails');
reset role;

set local request.jwt.claims = '{"sub":"5bc00000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"5b000000-0000-0000-0000-0000000000a2","default_branch_id":"5bb00000-0000-0000-0000-0000000000b3"}';
set local role authenticated;
select is((select count(*) from public.accounts), 0::bigint, 'a suspended client''s admin sees nothing, even though their branch is active');
reset role;

select * from finish();
rollback;
