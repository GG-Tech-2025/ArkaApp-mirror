-- Platform operator access and organization provisioning (pgTAP).
-- Run with `supabase test db`. Everything happens in one rolled-back transaction.
--
--   SA   super-admin, belongs to no organization
--   U1   admin of org E1
--   SAO  flagged super-admin who also belongs to org E2 (must get no extra reach)
--   N1..N4  auth users with no profile yet (future first admins)

begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('e1000000-0000-0000-0000-0000000000e1', 'Platform Test Org E1', 'platform-test-e1'),
  ('e2000000-0000-0000-0000-0000000000e2', 'Platform Test Org E2', 'platform-test-e2');

insert into public.branches (id, organization_id, name, code) values
  ('e1b00000-0000-0000-0000-0000000000e1', 'e1000000-0000-0000-0000-0000000000e1', 'E1', 'E1'),
  ('e2b00000-0000-0000-0000-0000000000e2', 'e2000000-0000-0000-0000-0000000000e2', 'E2', 'E2');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
         '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
  from (values
    ('43000000-0000-0000-0000-0000000000a0'::uuid, 'plat-sa@test.invalid'),
    ('43000000-0000-0000-0000-0000000000a1'::uuid, 'plat-u1@test.invalid'),
    ('43000000-0000-0000-0000-0000000000a2'::uuid, 'plat-sao@test.invalid'),
    ('43000000-0000-0000-0000-0000000000b1'::uuid, 'plat-n1@test.invalid'),
    ('43000000-0000-0000-0000-0000000000b2'::uuid, 'plat-n2@test.invalid'),
    ('43000000-0000-0000-0000-0000000000b3'::uuid, 'plat-n3@test.invalid'),
    ('43000000-0000-0000-0000-0000000000b4'::uuid, 'plat-n4@test.invalid')
  ) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id, is_super_admin) values
  ('43000000-0000-0000-0000-0000000000a0', '8300000000', 'ADMIN', null, null, true),
  ('43000000-0000-0000-0000-0000000000a1', '8300000001', 'ADMIN', 'e1000000-0000-0000-0000-0000000000e1', 'e1b00000-0000-0000-0000-0000000000e1', false),
  ('43000000-0000-0000-0000-0000000000a2', '8300000002', 'ADMIN', 'e2000000-0000-0000-0000-0000000000e2', 'e2b00000-0000-0000-0000-0000000000e2', true);

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('43000000-0000-0000-0000-0000000000a1', 'e1b00000-0000-0000-0000-0000000000e1', 'e1000000-0000-0000-0000-0000000000e1', 'MANAGER'),
  ('43000000-0000-0000-0000-0000000000a2', 'e2b00000-0000-0000-0000-0000000000e2', 'e2000000-0000-0000-0000-0000000000e2', 'MANAGER');

-- one tenant row, so "a super-admin sees no business data" is a real check
insert into public.accounts (account_number, opening_balance, balance, organization_id, branch_id)
values ('E1-BANK', 100, 100, 'e1000000-0000-0000-0000-0000000000e1', 'e1b00000-0000-0000-0000-0000000000e1');

-- ------------------------------------------------------------------
-- A super-admin (no organization in the token)
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"43000000-0000-0000-0000-0000000000a0","role":"authenticated","is_super_admin":true}';
set local role authenticated;

select is((select count(*) from public.organizations where id in ('e1000000-0000-0000-0000-0000000000e1', 'e2000000-0000-0000-0000-0000000000e2')),
  2::bigint, 'a super-admin sees every organization');
select is((select count(*) from public.branches where id in ('e1b00000-0000-0000-0000-0000000000e1', 'e2b00000-0000-0000-0000-0000000000e2')),
  2::bigint, 'a super-admin sees every branch');
select is((select count(*) from public.profiles where id in ('43000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a2')),
  2::bigint, 'a super-admin sees other users'' profiles');
select is((select count(*) from public.user_branch_access where user_id = '43000000-0000-0000-0000-0000000000a1'),
  1::bigint, 'a super-admin sees who has access to which branch');
select is((select count(*) from public.accounts), 0::bigint,
  'a super-admin sees no client business data');

select throws_ok($$insert into public.organizations (name, slug) values ('Sneaky', 'sneaky')$$,
  '42501', null, 'a super-admin cannot write organizations directly');
select throws_ok($$update public.profiles set phone = '8399999999' where id = '43000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'a super-admin cannot edit another user''s profile (no write privilege at all)');
select throws_ok($$select public.provision_organization('X', 'x-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b1', '8300000099')$$,
  '42501', null, 'even a super-admin cannot call provisioning directly (only the service role can)');
reset role;

select is((select phone from public.profiles where id = '43000000-0000-0000-0000-0000000000a1'),
  '8300000001', 'and that profile is unchanged');

-- ------------------------------------------------------------------
-- Ordinary users and a flagged user who belongs to an org
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"43000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"e1000000-0000-0000-0000-0000000000e1","default_branch_id":"e1b00000-0000-0000-0000-0000000000e1"}';
set local role authenticated;
select is((select array_agg(id) from public.organizations), array['e1000000-0000-0000-0000-0000000000e1']::uuid[],
  'a normal user sees only their own organization');
select is((select count(*) from public.profiles), 1::bigint, 'a normal user sees only their own profile');
reset role;

set local request.jwt.claims = '{"sub":"43000000-0000-0000-0000-0000000000a2","role":"authenticated","is_super_admin":true,"organization_id":"e2000000-0000-0000-0000-0000000000e2","default_branch_id":"e2b00000-0000-0000-0000-0000000000e2"}';
set local role authenticated;
select is((select array_agg(id) from public.organizations), array['e2000000-0000-0000-0000-0000000000e2']::uuid[],
  'a flagged user who belongs to an organization gets no extra reach from the flag');
reset role;

set local request.jwt.claims = '';
set local role anon;
select throws_ok($$select public.provision_organization('X', 'x-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b1', '8300000099')$$,
  '42501', null, 'anon cannot provision an organization');
reset role;

-- ------------------------------------------------------------------
-- provision_organization (run as the owner, like the service role)
-- ------------------------------------------------------------------
create temp table p1 as
  select public.provision_organization('  New Co  ', 'new-co', 'Main Plant', ' main ',
    '43000000-0000-0000-0000-0000000000b1', '8300000010', 'owner@newco.test') as r;

select ok((select r ? 'organization_id' and r ? 'branch_id' from p1), 'provisioning returns the new organization and branch ids');

select is((select o.name || '/' || o.status || '/' || o.plan || '/' || o.contact_email
           from public.organizations o where o.id = (select (r ->> 'organization_id')::uuid from p1)),
  'New Co/ACTIVE/trial/owner@newco.test', 'the organization is created active, on a trial, with the contact email');
select ok((select o.trial_ends_at > now() + interval '13 days' and o.trial_ends_at < now() + interval '15 days'
           from public.organizations o where o.id = (select (r ->> 'organization_id')::uuid from p1)),
  'the default trial is 14 days');
select is((select b.name || '/' || b.code || '/' || b.status from public.branches b where b.id = (select (r ->> 'branch_id')::uuid from p1)),
  'Main Plant/MAIN/ACTIVE', 'the first branch is created, with its code upper-cased');
select is((select p.role || '/' || p.is_super_admin::text || '/' || (p.organization_id = (select (r ->> 'organization_id')::uuid from p1))::text
                  || '/' || (p.default_branch_id = (select (r ->> 'branch_id')::uuid from p1))::text
           from public.profiles p where p.id = '43000000-0000-0000-0000-0000000000b1'),
  'ADMIN/false/true/true', 'the first admin gets an ADMIN profile in the new org and branch, and is not a super-admin');
select is((select count(*) from public.user_branch_access
           where user_id = '43000000-0000-0000-0000-0000000000b1' and branch_role = 'MANAGER'
             and branch_id = (select (r ->> 'branch_id')::uuid from p1)),
  1::bigint, 'the first admin can use the new branch');

select is((select count(*) from public.accounts where is_cash and branch_id = (select (r ->> 'branch_id')::uuid from p1)),
  1::bigint, 'the new branch has its cash account');
select is((select count(*) from public.app_settings where branch_id = (select (r ->> 'branch_id')::uuid from p1)),
  2::bigint, 'the new branch has its two settings');
select is((select count(*) from public.materials where branch_id = (select (r ->> 'branch_id')::uuid from p1)),
  5::bigint, 'the new branch has its five materials');

select is((select public.custom_access_token_hook(jsonb_build_object('user_id', '43000000-0000-0000-0000-0000000000b1', 'claims', '{}'::jsonb))
             -> 'claims' ->> 'organization_id'),
  (select r ->> 'organization_id' from p1), 'the first admin''s token will carry the new organization');
select is((select public.custom_access_token_hook(jsonb_build_object('user_id', '43000000-0000-0000-0000-0000000000b1', 'claims', '{}'::jsonb))
             -> 'claims' ->> 'default_branch_id'),
  (select r ->> 'branch_id' from p1), 'the first admin''s token will carry the new branch');

-- the new admin sees their own branch and nothing of the others
select set_config('request.jwt.claims',
  json_build_object('sub', '43000000-0000-0000-0000-0000000000b1', 'role', 'authenticated',
                    'organization_id', (select r ->> 'organization_id' from p1),
                    'default_branch_id', (select r ->> 'branch_id' from p1))::text, true);
grant select on p1 to authenticated;
set local role authenticated;
select is((select count(*) from public.accounts), 1::bigint, 'the new admin sees only their own branch''s account');
select is((select count(*) from public.accounts where is_cash), 1::bigint, 'and that account is their cash account');
select is((select count(*) from public.organizations), 1::bigint, 'the new admin sees only their own organization');
reset role;

-- ------------------------------------------------------------------
-- Refusals leave nothing behind
-- ------------------------------------------------------------------
select throws_ok($$select public.provision_organization('Dup Slug', 'new-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b2', '8300000020')$$,
  '23505', null, 'an organization slug can only be used once');
select throws_ok($$select public.provision_organization('Same Admin', 'same-admin-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b1', '8300000021')$$,
  '23505', 'That user already has a profile', 'a user who already has a profile cannot be made the first admin of another org');
select throws_ok($$select public.provision_organization('Dup Phone', 'dup-phone-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b3', '8300000010')$$,
  '23505', null, 'an admin phone already in use is refused');
select is((select count(*) from public.organizations where slug in ('dup-phone-co', 'same-admin-co')), 0::bigint,
  'a refused provisioning leaves no half-created organization behind');

select throws_ok($$select public.provision_organization('Bad Slug', 'Bad Slug', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b4', '8300000030')$$,
  '22023', null, 'a slug with capitals or spaces is refused');
select throws_ok($$select public.provision_organization('   ', 'blank-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b4', '8300000031')$$,
  '22023', 'Organization name is required', 'a blank name is refused');
select throws_ok($$select public.provision_organization('No Branch', 'no-branch-co', 'Main', '  ', '43000000-0000-0000-0000-0000000000b4', '8300000032')$$,
  '22023', 'Branch name and code are required', 'a blank branch code is refused');
select throws_ok($$select public.provision_organization('Zero Trial', 'zero-trial-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b4', '8300000033', null, 'trial', 0)$$,
  '22023', null, 'a trial of 0 days is refused');
select throws_ok($$select public.provision_organization('No User', 'no-user-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000ff', '8300000034')$$,
  'P0002', 'Admin user not found', 'an admin user that does not exist is refused');

select lives_ok($$select public.provision_organization('Paid Co', 'paid-co', 'Main', 'MAIN', '43000000-0000-0000-0000-0000000000b4', '8300000040', null, 'standard', 14)$$,
  'a non-trial plan can be provisioned');
select is((select trial_ends_at is null from public.organizations where slug = 'paid-co'), true,
  'a non-trial plan has no trial end date');

select * from finish();
rollback;
