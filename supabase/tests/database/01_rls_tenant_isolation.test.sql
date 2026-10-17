-- Cross-tenant isolation tests (pgTAP). Run with `supabase test db` (CI does this).
--
-- Builds two orgs (A with branches A1/A2, B with branch B1) and four users,
-- then impersonates each one and checks what they can see and do. Everything
-- happens inside one transaction that is rolled back, so nothing persists.
--
--   uA1   org A, access to A1 only        uA12  org A, access to A1 + A2
--   uB1   org B, access to B1             uNone org A, no branch access at all

begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

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

-- ------------------------------------------------------------------
-- Structural guards (catch a table or view added later without RLS)
-- ------------------------------------------------------------------
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint, 'RLS is enabled on every public table');

-- user_branch_access has a branch_id column but is a platform table with its
-- own read-only policy (own_access_read), so it is the one deliberate exclusion.
-- Any new platform table that also carries branch_id must be added here.
select is(
  (select count(*) from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'branch_id' and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname <> 'user_branch_access'
     and not exists (select 1 from pg_policies p
                     where p.schemaname = 'public' and p.tablename = c.relname
                       and p.policyname = 'tenant_isolation')),
  0::bigint, 'every table with a branch_id has a tenant_isolation policy');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not ('security_invoker=true' = any (coalesce(c.reloptions, array[]::text[])))),
  0::bigint, 'every public view is security_invoker (so it cannot bypass RLS)');

select throws_ok(
  $$insert into public.orders (customer_id, order_date, delivery_date, brick_quantity, final_price, organization_id, branch_id)
    values ('c1000000-0000-0000-0000-0000000000a1', current_date, current_date, 1, 1,
            'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-0000000000a2')$$,
  '23503', null, 'composite FK rejects an order whose customer lives in another branch');

select is(
  (select count(*) from public.customers where phone = '9000000001'),
  2::bigint, 'the same phone number can exist in two different branches');

-- ------------------------------------------------------------------
-- uA1: org A, branch A1 only
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a"}';
set local role authenticated;

select is((select count(*) from public.customers), 1::bigint, 'uA1 sees exactly one customer');
select is((select id from public.customers), 'c1000000-0000-0000-0000-0000000000a1'::uuid, 'uA1 sees only their own branch''s customer');
select is((select count(*) from public.orders), 1::bigint, 'uA1 sees only their branch''s orders');
select is((select count(*) from public.customer_financials), 1::bigint, 'a view does not leak other branches or orgs to uA1');
select is((select public.get_financial_summary() ->> 'total_receivables'), '1000', 'an RPC through a view only totals uA1''s branch');
select is((select id from public.organizations), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'uA1 sees only their own organization');
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
  'uA1 can still write in their own branch');
reset role;

select is(
  (select name from public.customers where id = 'c2000000-0000-0000-0000-0000000000a2'),
  'Cust A2', 'uA1 could not update a customer in a branch they cannot see');
select is(
  (select count(*) from public.customers where id = 'c3000000-0000-0000-0000-0000000000b1'),
  1::bigint, 'uA1 could not delete another organization''s customer');

-- ------------------------------------------------------------------
-- uA12: org A, branches A1 + A2
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"12000000-0000-0000-0000-0000000000a2","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a"}';
set local role authenticated;

select is((select count(*) from public.customers), 2::bigint, 'uA12 sees customers from both of their branches');
select is((select count(*) from public.orders), 2::bigint, 'uA12 sees orders from both of their branches');
select is((select count(*) from public.branches), 2::bigint, 'uA12 sees both of their branches');
select is((select public.get_financial_summary() ->> 'total_receivables'), '3000', 'uA12''s totals cover both branches but not org B');
reset role;

-- ------------------------------------------------------------------
-- uB1: org B, branch B1
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"21000000-0000-0000-0000-0000000000b1","role":"authenticated","organization_id":"b0000000-0000-0000-0000-00000000000b"}';
set local role authenticated;

select is((select id from public.customers), 'c3000000-0000-0000-0000-0000000000b1'::uuid, 'uB1 sees only org B''s customer, never org A''s');
select is((select count(*) from public.orders), 1::bigint, 'uB1 sees only org B''s orders');
select is((select public.get_financial_summary() ->> 'total_receivables'), '5000', 'uB1''s totals only cover org B');
select is((select id from public.organizations), 'b0000000-0000-0000-0000-00000000000b'::uuid, 'uB1 sees only their own organization');
reset role;

-- ------------------------------------------------------------------
-- uNone: in org A but granted no branches
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000000","role":"authenticated","organization_id":"a0000000-0000-0000-0000-00000000000a"}';
set local role authenticated;

select is((select count(*) from public.customers), 0::bigint, 'a user with no branch access sees no business data');
select is((select count(*) from public.branches), 0::bigint, 'a user with no branch access sees no branches');
reset role;

-- ------------------------------------------------------------------
-- Mismatched claim: uA1's identity, but a JWT claiming org B
-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11000000-0000-0000-0000-0000000000a1","role":"authenticated","organization_id":"b0000000-0000-0000-0000-00000000000b"}';
set local role authenticated;

select is((select count(*) from public.customers), 0::bigint, 'an org claim that does not match the user''s branches yields nothing');
reset role;

-- ------------------------------------------------------------------
-- anon: the public API key with no signed-in user
-- ------------------------------------------------------------------
set local request.jwt.claims = '';
set local role anon;

select is((select count(*) from public.customers), 0::bigint, 'anon sees no business data');
reset role;

-- ------------------------------------------------------------------
-- Auth hook
-- ------------------------------------------------------------------
-- The hook runs as supabase_auth_admin, a system role that neither the hosted
-- SQL API nor (necessarily) a test session may SET ROLE to. So here we check
-- the policy that grants it access to profiles exists, and that the hook's own
-- logic is right. The two together are verified end-to-end by a real sign-in
-- (see docs/MULTITENANCY_DEVLOG.md, Phase 3).
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
