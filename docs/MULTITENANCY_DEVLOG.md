# Multi-Tenancy Conversion — Dev Log

Running record of the ArkaApp-mirror single-tenant → multi-tenant SaaS conversion: what changed, why, and what bit us. **Append to this file after every step** — the Troubleshooting section is the part that pays off when a bug shows up months later.

Related: [ARCHITECTURE_AND_REUSE_GUIDE.md](../ARCHITECTURE_AND_REUSE_GUIDE.md) describes the original single-tenant app. Where the two disagree on the database, trust the migrations in `supabase/migrations/` (the guide has drifted — see Troubleshooting).

## 1. Environment map

| Thing | Value | Notes |
|---|---|---|
| Supabase org | `GG-Tech-2025's Org` (`fdppqynfbgketxhnwzzg`) | Free tier (Supabase branching needs a paid plan) |
| `Arka demo` | ref `icnxulbrbkhcfatepexb`, ap-southeast-2 | Original single-tenant schema. **Read-only reference — never write to it.** 0 rows in every table. |
| `arka-staging` | ref `cmsvefaylxayflifaqno`, ap-southeast-2 | All multi-tenant work happens here first. |
| Git remote `origin` | `GG-Tech-2025/ArkaApp-mirror` | This product's repo. |
| Git remote `client` | `arkatechteam-lang/ArkaApp` | The real client's repo. **Never push here.** |
| Local dev | No Docker installed | `supabase start` unavailable locally; CI runs it on GitHub runners. |
| App `.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Gitignored. Point at `arka-staging` to test multi-tenant work; point back at `Arka demo` otherwise. Restart `npm run dev` after editing. |

The existing real client is **not** being migrated into this product; they keep their own separate app and Supabase project. Everything in these projects is test data.

## 2. Workflow rules

- Every change goes on a branch off `main` (started 2026-10-11). Merge only when the owner says so.
- Schema changes are migration files in `supabase/migrations/` (timestamp-ordered) **and** applied to `arka-staging`. Keep the two in sync — if a migration is applied live but not committed (or vice versa), they will drift.
- Pushing is done by the repo owner manually.
- The Auth Hook (Phase 2) can only be enabled in the Supabase Dashboard — it is a click-ops step, not code.

## 3. Phase log

### Phase 0 — Safety net (2026-09-25)
- Reconstructed the live `Arka demo` schema into 4 baseline migrations: types/extensions → tables → views → functions/triggers (that order matters, see Troubleshooting #3). Result: 33 tables, 10 views, 15 functions, 1 trigger, 12 enums.
- Created `arka-staging` and applied the baseline; verified counts match.
- Added `supabase/config.toml` (`supabase init`) and `.github/workflows/supabase-migrations.yml`, which runs `supabase start` + `supabase db reset` on any PR touching `supabase/migrations/**`.
- Baseline deliberately includes a few things documented in the guide but missing on `Arka demo`: unique `(type_id, name)` on `expense_subtypes`, `idx_employee_name`, two `salary_ledger` indexes.

### Phase 1 — Tenancy schema (2026-09-27)
Migrations `20250927000001`–`05`:
1. `organizations`, `branches`, `user_branch_access`. Hierarchy: organization → branch → user access.
2. `organization_id` + `branch_id` added to all 32 domain tables; `profiles` instead gets `organization_id`, `default_branch_id`, `is_super_admin`. Each column indexed.
3. **34 composite FKs** `(child_col, branch_id) → parent(id, branch_id)` replacing plain FKs, **14 `UNIQUE(id, branch_id)`** parents, and **7 global uniques → branch-scoped** (`customers.phone`, `employees.phone`, `app_settings.key`, `salary_batches.month`, `cash_ledger_days.ledger_date`, `expense_types.name`, `expense_subtypes.(type_id,name)`).
4. `NOT NULL` on `organization_id`/`branch_id` for all 32 domain tables.
5. 40 follow-up indexes after Supabase's performance advisor flagged unindexed composite FKs.

`supabase/seed.sql` adds two test orgs for later RLS testing:

| Org | Branch | organization_id | branch_id |
|---|---|---|---|
| Acme Bricks | Acme North | `11111111-1111-1111-1111-111111111111` | `aaaaaaaa-0001-0001-0001-000000000001` |
| Acme Bricks | Acme South | `11111111-1111-1111-1111-111111111111` | `aaaaaaaa-0002-0002-0002-000000000002` |
| Beta Constructions | Beta Main | `22222222-2222-2222-2222-222222222222` | `bbbbbbbb-0001-0001-0001-000000000001` |

### Phase 2 — Auth & claims (2026-10-11 → 2026-10-17) — **complete**
- `20251011000001_phase2_custom_access_token_hook.sql`: `public.custom_access_token_hook(event jsonb)` reads the user's `profiles` row and adds `organization_id`, `default_branch_id`, `is_super_admin` to the JWT on every sign-in/refresh. Execute granted to `supabase_auth_admin` only (revoked from `public`/`anon`/`authenticated`); `supabase_auth_admin` also has `SELECT` on `profiles`.
- `supabase/config.toml`: hook wired for local/CI.
- Frontend: `getSessionClaims()` + `decodeJwtPayload()` in `src/services/middleware.service.ts`; `Profile` type updated and `SessionClaims` type added in `src/services/types.ts`.
- **Hook enabled on `arka-staging` by hand** in Dashboard → Authentication → Hooks.
- Verified twice: scripted sign-in (decoded JWT showed correct claims) and the owner's manual test through the real admin/employee login screens. No issues found.

### Phase 3+ — not started
RLS → frontend OrgContext/branch switcher → platform control plane → billing → ops hygiene → rollout.

## 4. Key decisions (and why)

- **One shared Supabase project, isolation by `organization_id`/`branch_id` + RLS** — not schema-per-tenant or DB-per-tenant. Cheapest to operate for "n clients"; Supabase tooling assumes it.
- **Every table gets both columns, including catalogs** (`materials`, `roles`, `expense_types`, `expense_subtypes`, `app_settings`). One uniform RLS pattern with no exceptions; cost is that a new branch starts with empty catalogs, so branch provisioning must seed them (Phase 5).
- **Composite FKs only between peer business tables.** `created_by → profiles` stays a plain FK (an actor reference, not branch-scoped data).
- **`profiles.organization_id` / `default_branch_id` stay nullable** so a platform super-admin (`is_super_admin = true`) can exist without belonging to any org.
- **Login is by email, not phone.** `profiles.phone` is only a contact field. Supabase Auth enforces `auth.users.email` uniqueness project-wide, so two orgs can never have users with the same login email.
- **Read claims from the JWT, not a second query.** `getSessionClaims()` decodes the access token already in the session.

## 5. Troubleshooting

Format: symptom → cause → fix.

1. **Supabase branching needs a paid plan** (this org is on free; we never tried creating a branch). Decision: use a separate `arka-staging` project instead.
2. **`supabase login` fails with "Cannot use automatic login flow inside non-TTY environments"** → needs a real terminal for the browser OAuth. Fix: run it in your own terminal. Everything in this repo so far was done through the Supabase MCP instead, so the CLI login isn't required.
3. **Migration fails: `relation "customer_financials" does not exist`** → `get_financial_summary()` reads views, so views must exist before functions. Fix: migration order is types → tables → **views → functions**. (Filenames `…03_views`, `…04_functions`.)
4. **Auth hook has no effect after applying the migration** → the function alone does nothing; it must be enabled in Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims" → Postgres function → `custom_access_token_hook`. Locally, `[auth.hook.custom_access_token]` in `supabase/config.toml`.
5. **JWT has `organization_id: null`** → user has no `profiles` row, or the row's `organization_id` is null (super-admin). Check: `select * from profiles where id = '<uid>'`. A missing profiles row doesn't error — claims just come back null/false.
6. **`signUp()` returns 400 `email_address_invalid`** on `arka-staging` — seen with an `@example.com` address and an `@arka-staging.test` address. Exact cause not confirmed (likely the project's email-domain validation). Fix: create test users in Dashboard → Authentication → Users → Add user (tick "Auto Confirm User").
7. **Sign-in returns 500 `AuthRetryableFetchError: {}` for a user inserted with raw SQL** → auth log shows `error finding user: sql: Scan error on column index 8, name "email_change": converting NULL to string is unsupported`. Cause: rows inserted straight into `auth.users` left `email_change`, `email_change_token_new`, `email_change_token_current`, `phone_change`, `phone_change_token`, `reauthentication_token` as NULL, which GoTrue can't scan. Fix: set them to `''` (or just use the Dashboard to create users). This is **not** a hook bug — check the auth logs before suspecting the hook.
8. **Where to look when auth misbehaves** → Dashboard → Logs → Auth (or `query_logs` with `source = 'auth_logs'`). `postgres_logs` showed nothing useful for the sign-in failure above.
9. **Guide vs reality drift** → `ARCHITECTURE_AND_REUSE_GUIDE.md` claims RLS protects data (it doesn't — RLS is off on every table until Phase 3), documents indexes/constraints not present on `Arka demo`, and lists a `procurement_requests` table that is actually `procurements`. Trust the migrations.
10. **No type-checker in the repo** → `typescript` isn't a dependency and there's no typecheck script. `npm run build` only catches syntax/import errors, not type errors. Review types by eye.
11. **Supabase advisor noise** → `unused_index` (71) is expected on empty tables. `function_search_path_mutable` (15 functions) predates this work; fix opportunistically.

## 6. Landmines for Phase 3 (RLS) — read before starting

- **All 10 views bypass RLS.** They're `SECURITY DEFINER`-style (no `security_invoker`), so once RLS is on the base tables `customer_financials`, `vendor_financials`, etc. would still return every org's rows. Recreate each with `with (security_invoker = true)` (Postgres 17 supports it).
- **`supabase_auth_admin` must still be able to read `profiles`** after RLS is enabled there, or the access-token hook will silently stop injecting claims (see #5). Add a policy for that role, or verify claims right after enabling RLS on `profiles`.
- **The 15 RPC functions** (`apply_*_fifo`, `reverse_*`, `get_*`) are `SECURITY INVOKER` and don't filter by org/branch themselves — they rely on RLS on the tables they touch. Re-test each with two orgs' data after RLS lands.
- **`profiles.phone` stays globally unique** (it was not converted to branch-scoped) — fine for now since it's not an auth identifier, but revisit if two orgs need overlapping phone numbers.
- RLS is currently **off on all 36 public tables** (the 33 original + `organizations`, `branches`, `user_branch_access`), so anyone with the anon key can read/write everything. Fine on a test project; not acceptable for any real tenant.

## 7. Handy checks

```sql
-- Tables carrying the tenancy columns (expect 35 incl. branches + user_branch_access)
select count(*) from information_schema.columns
where table_schema='public' and column_name='organization_id';

-- Composite FKs (expect 34) and (id, branch_id) uniques (expect 14)
select count(*) from information_schema.table_constraints
where constraint_schema='public' and constraint_type='FOREIGN KEY' and constraint_name like '%_branch_fkey';
select count(*) from information_schema.table_constraints
where constraint_schema='public' and constraint_type='UNIQUE' and constraint_name like '%_id_branch_key';

-- Dry-run the hook without logging in
select public.custom_access_token_hook(jsonb_build_object(
  'user_id', '<uid>', 'claims', jsonb_build_object('sub','<uid>')));
```

Decode a token in the browser console without pasting it anywhere external:
`JSON.parse(atob("<token>".split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))`
