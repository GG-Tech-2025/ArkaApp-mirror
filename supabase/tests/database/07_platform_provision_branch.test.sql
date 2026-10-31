-- Adding a branch to an existing organization from the platform (pgTAP).
-- Run with `supabase test db`. Everything happens in one rolled-back transaction.
--
--   SA   platform super-admin (no organization)
--   A1   admin of org G1   A2  second admin of G1   EMP  employee of G1   A3  admin of org G2
-- G1 has one branch (G1B1), G2 has one branch.

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into public.organizations (id, name, slug) values
  ('a1000000-0000-0000-0000-0000000000a1', 'Branch Test Org G1', 'branch-test-g1'),
  ('a2000000-0000-0000-0000-0000000000a2', 'Branch Test Org G2', 'branch-test-g2');
insert into public.organizations (id, name, slug, status) values
  ('a3000000-0000-0000-0000-0000000000a3', 'Branch Test Org Suspended', 'branch-test-susp', 'SUSPENDED');

insert into public.branches (id, organization_id, name, code) values
  ('a1b00000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'G1 First', 'FIRST'),
  ('a2b00000-0000-0000-0000-0000000000a2', 'a2000000-0000-0000-0000-0000000000a2', 'G2 First', 'FIRST');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
         '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
  from (values
    ('47000000-0000-0000-0000-0000000000a0'::uuid, 'br-sa@test.invalid'),
    ('47000000-0000-0000-0000-0000000000a1'::uuid, 'br-a1@test.invalid'),
    ('47000000-0000-0000-0000-0000000000a2'::uuid, 'br-a2@test.invalid'),
    ('47000000-0000-0000-0000-0000000000e1'::uuid, 'br-emp@test.invalid'),
    ('47000000-0000-0000-0000-0000000000a3'::uuid, 'br-a3@test.invalid')
  ) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id, is_super_admin) values
  ('47000000-0000-0000-0000-0000000000a0', '8600000000', 'ADMIN', null, null, true),
  ('47000000-0000-0000-0000-0000000000a1', '8600000001', 'ADMIN', 'a1000000-0000-0000-0000-0000000000a1', 'a1b00000-0000-0000-0000-0000000000a1', false),
  ('47000000-0000-0000-0000-0000000000a2', '8600000002', 'ADMIN', 'a1000000-0000-0000-0000-0000000000a1', 'a1b00000-0000-0000-0000-0000000000a1', false),
  ('47000000-0000-0000-0000-0000000000e1', '8600000003', 'EMPLOYEE', 'a1000000-0000-0000-0000-0000000000a1', 'a1b00000-0000-0000-0000-0000000000a1', false),
  ('47000000-0000-0000-0000-0000000000a3', '8600000004', 'ADMIN', 'a2000000-0000-0000-0000-0000000000a2', 'a2b00000-0000-0000-0000-0000000000a2', false);

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('47000000-0000-0000-0000-0000000000a1', 'a1b00000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'MANAGER'),
  ('47000000-0000-0000-0000-0000000000a2', 'a1b00000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'MANAGER'),
  ('47000000-0000-0000-0000-0000000000e1', 'a1b00000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'STAFF'),
  ('47000000-0000-0000-0000-0000000000a3', 'a2b00000-0000-0000-0000-0000000000a2', 'a2000000-0000-0000-0000-0000000000a2', 'MANAGER');

-- ------------------------------------------------------------------
-- Who may call it
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"47000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"a1000000-0000-0000-0000-0000000000a1","default_branch_id":"a1b00000-0000-0000-0000-0000000000a1"}';
set local role authenticated;
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'Sneaky', 'SNEAK', current_date + 30)$$,
  '42501', 'Only platform administrators can add branches', 'a client admin cannot add a branch, not even to their own organization');
reset role;

set local request.jwt.claims = '{"sub":"47000000-0000-0000-0000-0000000000a2","role":"authenticated","is_super_admin":true,"organization_id":"a1000000-0000-0000-0000-0000000000a1","default_branch_id":"a1b00000-0000-0000-0000-0000000000a1"}';
set local role authenticated;
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'Sneaky', 'SNEAK', current_date + 30)$$,
  '42501', null, 'a token that merely claims is_super_admin gets nothing: the profile is checked, live');
reset role;

set local request.jwt.claims = '';
set local role anon;
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'Sneaky', 'SNEAK', current_date + 30)$$,
  '42501', null, 'anon cannot add a branch');
reset role;

select is((select count(*) from public.branches where organization_id = 'a1000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'none of those attempts created a branch');

-- ------------------------------------------------------------------
-- A super-admin adds a branch
-- ------------------------------------------------------------------
create temp table b1 (r jsonb);
grant all on b1 to authenticated;

set local request.jwt.claims = '{"sub":"47000000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;

insert into b1 select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', '  North Plant  ', ' north ', current_date + 30);

select ok((select r ? 'branch_id' and r ? 'admins_granted' from b1), 'the new branch id and the number of admins given access are returned');
select is((select (r ->> 'admins_granted')::int from b1), 2, 'both of the client''s admins were given access');
select is((select b.name || '/' || b.code || '/' || b.status || '/' || (b.organization_id = 'a1000000-0000-0000-0000-0000000000a1')::text
           from public.branches b where b.id = (select (r ->> 'branch_id')::uuid from b1)),
  'North Plant/NORTH/ACTIVE/true', 'the branch is created under that organization, trimmed, with its code upper-cased');
reset role;

select is((select b.renewal_date from public.branches b where b.id = (select (r ->> 'branch_id')::uuid from b1)),
  current_date + 30, 'the branch gets the renewal date that was given');
select is((select e.event_type || '/' || (e.actor_id = '47000000-0000-0000-0000-0000000000a0')::text
           from public.branch_billing_events e where e.branch_id = (select (r ->> 'branch_id')::uuid from b1)),
  'CREATED/true', 'its history starts with a CREATED entry naming the super-admin who added it');

select is((select count(*) from public.accounts where is_cash and branch_id = (select (r ->> 'branch_id')::uuid from b1)),
  1::bigint, 'the new branch has its cash account');
select is((select count(*) from public.app_settings where branch_id = (select (r ->> 'branch_id')::uuid from b1)),
  2::bigint, 'the new branch has its two settings');
select is((select count(*) from public.materials where branch_id = (select (r ->> 'branch_id')::uuid from b1)),
  5::bigint, 'the new branch has its five materials');
select is((select array_agg(user_id order by user_id) from public.user_branch_access where branch_id = (select (r ->> 'branch_id')::uuid from b1)),
  array['47000000-0000-0000-0000-0000000000a1', '47000000-0000-0000-0000-0000000000a2']::uuid[],
  'exactly the two admins can use it: not the employee, not another organization''s admin');

-- the admin really can work in it (switch, then see only that branch's cash account)
set local request.jwt.claims = '{"sub":"47000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;
select is((select array_agg(code order by code) from public.branches), array['FIRST', 'NORTH']::text[],
  'the client''s admin now sees both of their branches');
select lives_ok($$select public.set_active_branch((select (r ->> 'branch_id')::uuid from b1))$$,
  'and can switch to the new one');
reset role;

set local request.jwt.claims = '{"sub":"47000000-0000-0000-0000-0000000000a3","role":"authenticated","organization_id":"a2000000-0000-0000-0000-0000000000a2","default_branch_id":"a2b00000-0000-0000-0000-0000000000a2"}';
set local role authenticated;
select is((select count(*) from public.branches where code = 'NORTH'), 0::bigint, 'another organization''s admin does not see the new branch');
reset role;

-- ------------------------------------------------------------------
-- Refusals
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"47000000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'Dup', 'north', current_date + 30)$$,
  '23505', null, 'a branch code already used in that organization is refused (whatever the case)');
select lives_ok($$select public.provision_branch('a2000000-0000-0000-0000-0000000000a2', 'Other Org North', 'NORTH', current_date + 30)$$,
  'but another organization may use the same code');
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'Past', 'PAST', current_date - 1)$$,
  '22023', 'The renewal date is required and cannot be in the past', 'a renewal date in the past is refused');
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', '   ', 'X1', current_date + 30)$$,
  '22023', 'Branch name is required (up to 200 characters)', 'a blank name is refused');
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'No Code', '   ', current_date + 30)$$,
  '22023', 'Branch code is required (up to 20 characters)', 'a blank code is refused');
select throws_ok($$select public.provision_branch('a1000000-0000-0000-0000-0000000000a1', 'Long Code', 'THIS-CODE-IS-FAR-TOO-LONG', current_date + 30)$$,
  '22023', null, 'a code over 20 characters is refused');
select throws_ok($$select public.provision_branch('00000000-0000-0000-0000-0000000000ff', 'Ghost', 'GHOST', current_date + 30)$$,
  'P0002', 'Organization not found', 'an organization that does not exist is refused');
select throws_ok($$select public.provision_branch('a3000000-0000-0000-0000-0000000000a3', 'Late', 'LATE', current_date + 30)$$,
  '55000', 'Organization is not active', 'a suspended organization cannot get a new branch');
reset role;

select is((select count(*) from public.branches where organization_id in ('a1000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-0000000000a3')),
  2::bigint, 'the refusals left nothing behind (the original branch plus the one good one)');

select * from finish();
rollback;
