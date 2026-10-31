-- Phase 1, Step 6: test organizations + branches for Phase 3 RLS isolation QA.
-- No real client data is migrated here — this product has no live tenants yet.
-- Run automatically by `supabase db reset` (local/CI). Applied to the hosted
-- arka-staging project directly via the same INSERTs.

insert into public.organizations (id, name, slug, status, plan)
values
  ('11111111-1111-1111-1111-111111111111', 'Acme Bricks', 'acme-bricks', 'ACTIVE', 'trial'),
  ('22222222-2222-2222-2222-222222222222', 'Beta Constructions', 'beta-constructions', 'ACTIVE', 'trial');

insert into public.branches (id, organization_id, name, code, status)
values
  ('aaaaaaaa-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Acme North', 'NORTH', 'ACTIVE'),
  ('aaaaaaaa-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111', 'Acme South', 'SOUTH', 'ACTIVE'),
  ('bbbbbbbb-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'Beta Main', 'MAIN', 'ACTIVE');
