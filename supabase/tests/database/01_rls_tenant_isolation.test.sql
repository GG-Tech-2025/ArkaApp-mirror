-- Cross-tenant isolation tests (pgTAP). Run with `supabase test db` (CI does this).
--
-- Builds two orgs (A with branches A1/A2, B with branch B1) and four users,
-- then impersonates each one and checks what they can see and do. Everything
-- happens inside one transaction that is rolled back, so nothing persists.
--
--   uA1   org A, access to A1 only        uA12  org A, access to A1 + A2
--   uB1   org B, access to B1             uNone org A, no branch access at all
--
-- A user works in ONE branch at a time: the one in their JWT's
-- default_branch_id claim, honoured only while they still have access to it.

begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

-- ------------------------------------------------------------------
-- Fixtures (run as the table owner, so RLS does not apply)
-- ------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'RLS Test Org A', 'rls-test-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'RLS Test Org B', 'rls-test-b');

insert into public.branches (id, organization_id, name, code) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'A1', 'A1'),
  ('a2000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'A2', 'A2'),
  ('b1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'B1', 'B1');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '', now(), '{}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('11000000-0000-0000-0000-0000000000a1'::uuid, 'rls-ua1@test.invalid'),
  ('12000000-0000-0000-0000-0000000000a2'::uuid, 'rls-ua12@test.invalid'),
  ('21000000-0000-0000-0000-0000000000b1'::uuid, 'rls-ub1@test.invalid'),
  ('31000000-0000-0000-0000-000000000000'::uuid, 'rls-unone@test.invalid')
) as u(id, email);

insert into public.profiles (id, phone, role, organization_id, default_branch_id) values
  ('11000000-0000-0000-0000-0000000000a1', '8000000001', 'ADMIN', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1'),
  ('12000000-0000-0000-0000-0000000000a2', '8000000002', 'ADMIN', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1'),
  ('21000000-0000-0000-0000-0000000000b1', '8000000003', 'ADMIN', 'b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-0000000000b1'),
  ('31000000-0000-0000-0000-000000000000', '8000000004', 'EMPLOYEE', 'a0000000-0000-0000-0000-00000000000a', null);

insert into public.user_branch_access (user_id, branch_id, organization_id, branch_role) values
  ('11000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'STAFF'),
  ('12000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'MANAGER'),
  ('12000000-0000-0000-0000-0000000000a2', 'a2000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'MANAGER'),
  ('21000000-0000-0000-0000-0000000000b1', 'b1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'STAFF');

-- cA1 and cB1 deliberately share a phone number: uniqueness is per branch.
insert into public.customers (id, name, phone, organization_id, branch_id) values
  ('c1000000-0000-0000-0000-0000000000a1', 'Cust A1', '9000000001', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1'),
  ('c2000000-0000-0000-0000-0000000000a2', 'Cust A2', '9000000002', 'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-0000000000a2'),
  ('c3000000-0000-0000-0000-0000000000b1', 'Cust B1', '9000000001', 'b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-0000000000b1');

insert into public.orders (id, customer_id, order_date, delivery_date, brick_quantity, final_price, delivered, organization_id, branch_id) values
  ('d1000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a1', current_date, current_date, 100, 1000, true, 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1'),
  ('d2000000-0000-0000-0000-0000000000a2', 'c2000000-0000-0000-0000-0000000000a2', current_date, current_date, 200, 2000, true, 'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-0000000000a2'),
  ('d3000000-0000-0000-0000-0000000000b1', 'c3000000-0000-0000-0000-0000000000b1', current_date, current_date, 500, 5000, true, 'b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-0000000000b1');

create temp table hook_out (r jsonb);
grant all on hook_out to public;
create temp table hook_after_switch (r jsonb);
grant all on hook_after_switch to public;

-- ------------------------------------------------------------------
-- Structural guards (catch a table or view added later without RLS)
-- ------------------------------------------------------------------
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint, 'RLS is enabled on every public table');

-- user_branch_access and branch_billing_events have a branch_id column but are platform
-- tables with their own read-only policies (own_access_read / super_admin_read), so they are
-- the deliberate exclusions.
-- Any new platform table that also carries branch_id must be added here.
select is(
  (select count(*) from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'branch_id' and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname not in ('user_branch_access', 'branch_billing_events')
     and not exists (select 1 from pg_policies p
                     where p.schemaname = 'public' and p.tablename = c.relname
                       and p.policyname = 'tenant_isolation')),
  0::bigint, 'every table with a branch_id has a tenant_isolation policy');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not ('security_invoker=true' = any (coalesce(c.reloptions, array[]::text[])))),
  0::bigint, 'every public view is security_invoker (so it cannot bypass RLS)');

select is(
  (select count(*) from information_schema.columns c
   where c.table_schema = 'public'
     and c.column_name in ('organization_id', 'branch_id')
     and c.table_name in (select tablename from pg_policies
                          where schemaname = 'public' and policyname = 'tenant_isolation')
     and c.column_default is null),
  0::bigint, 'every tenant table defaults organization_id and branch_id from the token');

select throws_ok(
  $$insert into public.orders (customer_id, order_date, delivery_date, brick_quantity, final_price, organization_id, branch_id)
    values ('c1000000-0000-0000-0000-0000000000a1', current_date, current_date, 1, 1,
            'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-0000000000a2')$$,
  '23503', null, 'composite FK rejects an order whose customer lives in another branch');

select is(
  (select count(*) from public.customers where phone = '9000000001'),
  2::bigint, 'the same phone number can exist in two different branches');

-- ------------------------------------------------------------------
-- uA1: org A, branch A1 only, active branch A1
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select is((select array_agg(id) from public.customers), array['c1000000-0000-0000-0000-0000000000a1']::uuid[], 'uA1 sees only their own branch''s customer');
select is((select count(*) from public.orders), 1::bigint, 'uA1 sees only their branch''s orders');
select is((select count(*) from public.customer_financials), 1::bigint, 'a view does not leak other branches or orgs to uA1');
select is((select public.get_financial_summary() ->> 'total_receivables'), '1000', 'an RPC through a view only totals uA1''s branch');
select is((select array_agg(id) from public.organizations), array['a0000000-0000-0000-0000-00000000000a']::uuid[], 'uA1 sees only their own organization');
select is((select count(*) from public.branches), 1::bigint, 'uA1 sees only the branch they have access to');
select is((select count(*) from public.user_branch_access), 1::bigint, 'uA1 sees only their own access rows');
select is((select count(*) from public.profiles), 1::bigint, 'uA1 sees only their own profile');

select throws_ok(
  $$insert into public.customers (name, phone, organization_id, branch_id)
    values ('x', '9111111111', 'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'uA1 cannot insert into a branch they have no access to');
select throws_ok(
  $$insert into public.customers (name, phone, organization_id, branch_id)
    values ('x', '9111111112', 'b0000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'uA1 cannot insert a row tagged with another organization');
-- Attempted tampering: RLS makes these silently match zero rows. They are
-- verified after `reset role`, from the owner's point of view.
update public.customers set name = 'hijacked' where id = 'c2000000-0000-0000-0000-0000000000a2';
delete from public.customers where id = 'c3000000-0000-0000-0000-0000000000b1';
select throws_ok(
  $$update public.profiles set is_super_admin = true where id = '11000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'uA1 cannot promote themselves to super-admin');
select throws_ok(
  $$insert into public.organizations (name, slug) values ('evil', 'evil')$$,
  '42501', null, 'uA1 cannot create an organization');
select throws_ok(
  $$insert into public.user_branch_access (user_id, branch_id, organization_id)
    values ('11000000-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'uA1 cannot grant themselves access to another branch');
select throws_ok(
  $$select public.custom_access_token_hook('{"user_id":"11000000-0000-0000-0000-0000000000a1","claims":{}}'::jsonb)$$,
  '42501', null, 'signed-in users cannot call the auth hook directly');
select lives_ok(
  $$insert into public.materials (name, unit, organization_id, branch_id)
    values ('Test sand', 'kg', 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1')$$,
  'uA1 can write in their own branch with explicit ids');
select lives_ok(
  $$insert into public.materials (name, unit) values ('Default sand', 'kg')$$,
  'uA1 can insert without naming the org or branch (they come from the token)');
reset role;

select is(
  (select name from public.customers where id = 'c2000000-0000-0000-0000-0000000000a2'),
  'Cust A2', 'uA1 could not update a customer in a branch they cannot see');
select is(
  (select count(*) from public.customers where id = 'c3000000-0000-0000-0000-0000000000b1'),
  1::bigint, 'uA1 could not delete another organization''s customer');
select is(
  (select organization_id || '/' || branch_id from public.materials where name = 'Default sand'),
  'a0000000-0000-0000-0000-00000000000a/a1000000-0000-0000-0000-0000000000a1',
  'a defaulted insert lands in the token''s org and active branch');

-- ------------------------------------------------------------------
-- uA12: can access A1 + A2, but works in ONE at a time
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"12000000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select is((select array_agg(id) from public.customers), array['c1000000-0000-0000-0000-0000000000a1']::uuid[], 'uA12 with active branch A1 sees only A1''s customers, not A2''s');
select is((select count(*) from public.branches), 2::bigint, 'uA12 can still list both of their branches (for the switcher)');
select is((select public.get_financial_summary() ->> 'total_receivables'), '1000', 'uA12''s totals cover only the active branch');
select throws_ok(
  $$insert into public.customers (name, phone, organization_id, branch_id)
    values ('x', '9222222221', 'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'uA12 cannot write into A2 while A1 is active');
select lives_ok(
  $$insert into public.materials (name, unit) values ('A12 default A1', 'kg')$$,
  'uA12 can insert with defaults while A1 is active');
reset role;

set local request.jwt.claims = '{"sub":"12000000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a2000000-0000-0000-0000-0000000000a2"}';
set local role authenticated;

select is((select array_agg(id) from public.customers), array['c2000000-0000-0000-0000-0000000000a2']::uuid[], 'uA12 with active branch A2 sees only A2''s customers');
select is((select public.get_financial_summary() ->> 'total_receivables'), '2000', 'uA12''s totals follow the active branch');
select lives_ok(
  $$insert into public.materials (name, unit) values ('A12 default A2', 'kg')$$,
  'uA12 can insert with defaults while A2 is active');
reset role;

select is(
  (select branch_id from public.materials where name = 'A12 default A1'),
  'a1000000-0000-0000-0000-0000000000a1'::uuid, 'a defaulted insert follows the active branch (A1)');
select is(
  (select branch_id from public.materials where name = 'A12 default A2'),
  'a2000000-0000-0000-0000-0000000000a2'::uuid, 'a defaulted insert follows the active branch (A2)');

-- ------------------------------------------------------------------
-- Fail closed: no valid active branch means no access
-- ------------------------------------------------------------------
-- uA1's token claims branch A2, which they have no access to.
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a2000000-0000-0000-0000-0000000000a2"}';
set local role authenticated;

select is((select count(*) from public.customers), 0::bigint, 'a claim for a branch the user cannot access yields nothing');
select throws_ok(
  $$insert into public.materials (name, unit) values ('should fail', 'kg')$$,
  '42501', null, 'with no valid active branch an insert without ids is rejected');
reset role;

-- uA1's token has no branch claim at all.
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a"}';
set local role authenticated;

select is((select count(*) from public.customers), 0::bigint, 'a token with no active branch sees nothing');
reset role;

-- uA1's identity, but a token claiming org B.
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"b0000000-0000-0000-0000-00000000000b","default_branch_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select is((select count(*) from public.customers), 0::bigint, 'an org claim that does not match the user''s branch yields nothing');
reset role;

-- ------------------------------------------------------------------
-- uB1: org B
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"21000000-0000-0000-0000-0000000000b1","role":"authenticated","organization_id":"b0000000-0000-0000-0000-00000000000b","default_branch_id":"b1000000-0000-0000-0000-0000000000b1"}';
set local role authenticated;

select is((select array_agg(id) from public.customers), array['c3000000-0000-0000-0000-0000000000b1']::uuid[], 'uB1 sees only org B''s customer, never org A''s');
select is((select count(*) from public.orders), 1::bigint, 'uB1 sees only org B''s orders');
select is((select public.get_financial_summary() ->> 'total_receivables'), '5000', 'uB1''s totals only cover org B');
select is((select array_agg(id) from public.organizations), array['b0000000-0000-0000-0000-00000000000b']::uuid[], 'uB1 sees only their own organization');
reset role;

-- ------------------------------------------------------------------
-- uNone: in org A but granted no branches
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000000","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select is((select count(*) from public.customers), 0::bigint, 'a user with no branch access sees no business data');
select is((select count(*) from public.branches), 0::bigint, 'a user with no branch access sees no branches');
reset role;

-- ------------------------------------------------------------------
-- anon: the public API key with no signed-in user
-- ------------------------------------------------------------------
set local request.jwt.claims = '';
set local role anon;

-- anon holds no table privileges at all (security_hardening), so this is refused outright
-- rather than returning an empty result.
select throws_ok($$select count(*) from public.customers$$, '42501', null, 'anon cannot read business data');
reset role;

-- ------------------------------------------------------------------
-- Switching branch (last, because it changes uA12's profile)
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"12000000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;

select is(
  (select public.set_active_branch('a2000000-0000-0000-0000-0000000000a2')),
  'a2000000-0000-0000-0000-0000000000a2'::uuid, 'uA12 can switch to another branch they have access to');
select throws_ok(
  $$select public.set_active_branch('b1000000-0000-0000-0000-0000000000b1')$$,
  '42501', null, 'uA12 cannot switch to another organization''s branch');
reset role;

select is(
  (select default_branch_id from public.profiles where id = '12000000-0000-0000-0000-0000000000a2'),
  'a2000000-0000-0000-0000-0000000000a2'::uuid, 'switching saved the new branch on the profile');

insert into hook_after_switch
  select public.custom_access_token_hook(
    '{"user_id":"12000000-0000-0000-0000-0000000000a2","claims":{"sub":"12000000-0000-0000-0000-0000000000a2"}}'::jsonb);
select is(
  (select r -> 'claims' ->> 'default_branch_id' from hook_after_switch),
  'a2000000-0000-0000-0000-0000000000a2', 'the next token carries the newly selected branch');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000000","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a","default_branch_id":"a1000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;
select throws_ok(
  $$select public.set_active_branch('a1000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'a user cannot switch to a branch they have no access row for');
reset role;

set local request.jwt.claims = '';
set local role anon;
select throws_ok(
  $$select public.set_active_branch('a1000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'anon cannot switch branch');
reset role;

-- ------------------------------------------------------------------
-- Auth hook
-- ------------------------------------------------------------------
-- The hook runs as supabase_auth_admin, a system role that neither the hosted
-- SQL API nor (necessarily) a test session may SET ROLE to. So here we check
-- the policy that grants it access to profiles exists, and that the hook's own
-- logic is right. The two together are verified end-to-end by a real sign-in
-- (see docs/MULTITENANCY_DEVLOG.md).
select ok(
  exists (select 1 from pg_policies
          where schemaname = 'public' and tablename = 'profiles'
            and policyname = 'auth_admin_read' and 'supabase_auth_admin' = any (roles)),
  'supabase_auth_admin has a read policy on profiles (the auth hook depends on it)');

insert into hook_out
  select public.custom_access_token_hook(
    '{"user_id":"11000000-0000-0000-0000-0000000000a1","claims":{"sub":"11000000-0000-0000-0000-0000000000a1"}}'::jsonb);

select is((select r -> 'claims' ->> 'organization_id' from hook_out), 'a0000000-0000-0000-0000-00000000000a', 'auth hook injects organization_id');
select is((select r -> 'claims' ->> 'default_branch_id' from hook_out), 'a1000000-0000-0000-0000-0000000000a1', 'auth hook injects default_branch_id');
select is((select r -> 'claims' ->> 'is_super_admin' from hook_out), 'false', 'auth hook injects is_super_admin');

select * from finish();
rollback;
