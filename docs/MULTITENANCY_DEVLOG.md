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
- **Migration filenames must carry the version Supabase recorded** when the migration was applied (check `list_migrations` after applying, then name the file `<that version>_<name>.sql`). Applying through the MCP stamps its own timestamp; a mismatched filename causes drift (see Troubleshooting #12). Phase 3 files follow this; Phase 0–2 files don't.
- Pushing is done by the repo owner manually.
- The Auth Hook (Phase 2) can only be enabled in the Supabase Dashboard — it is a click-ops step, not code.

## 3. Phase log

### Phase 0 — Safety net (2026-09-25)
- Reconstructed the live `Arka demo` schema into 4 baseline migrations: types/extensions → tables → views → functions/triggers (that order matters, see Troubleshooting #3). Result: 33 tables, 10 views, 15 functions, 1 trigger, 12 enums.
- Created `arka-staging` and applied the baseline; verified counts match.
- Added `supabase/config.toml` (`supabase init`) and `.github/workflows/supabase-migrations.yml`, which runs `supabase start` + `supabase db reset` on any PR touching `supabase/migrations/**` (Phase 3 extended it to also run `supabase test db` and to trigger on `supabase/tests/**`, `seed.sql`, `config.toml`). The workflow has never run yet — it will on the first PR that touches those paths, and may need fixes since nothing here could run Docker locally.
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

### Phase 3 — Row Level Security (2026-10-17) — **applied to `arka-staging` and verified**
Migrations `20261017122408`–`…431`:
1. `rls_helpers`: `private.current_org_id()` (org from the JWT claim) and `private.accessible_branch_ids()` (the caller's `user_branch_access` branches, limited to the org in their JWT, read live; `SECURITY DEFINER`). They live in a `private` schema so PostgREST can't expose them as RPC.
2. `access_integrity`: composite FKs so `user_branch_access` and `profiles.default_branch_id` can only point at a branch of the stated org.
3. `enable_rls_policies`: RLS on all 36 public tables.
   - 32 tenant tables: one `tenant_isolation` policy (`organization_id` = JWT org **and** `branch_id` in the accessible set, for both `USING` and `WITH CHECK`).
   - `organizations`, `branches`, `user_branch_access`, `profiles`: **read-only** for normal users (own org / accessible branches / own access rows / own profile). Insert/update/delete/truncate also revoked from `anon`/`authenticated` on those four.
   - `supabase_auth_admin` gets a read policy on `profiles` so the auth hook keeps working.
4. `views_security_invoker`: all 10 views set to `security_invoker = true`.

Tests: `supabase/tests/database/01_rls_tenant_isolation.test.sql` — pgTAP, 39 assertions over two orgs / three branches / four users; CI now runs `supabase test db`. Also covers structural guards that fail if a future table or view is added without RLS.

Verified on `arka-staging`:
- All 39 assertions pass. A **negative control** (RLS switched off on `customers` inside a rolled-back transaction) makes the same check fail — the suite can detect a leak.
- A real sign-in through the API: claims still injected with RLS on (the Phase 3 landmine below is defused); the user saw only their own branch's customers, their own org, and only that branch through `customer_financials`; inserting into another branch, self-promoting to super-admin, and calling the auth hook directly were all rejected; the anon key saw nothing.
- Advisor: both ERROR lints (RLS disabled, security-definer views) cleared. Still open: `function_search_path_mutable` ×15 (pre-existing) and `auth_leaked_password_protection` (an Auth dashboard setting — turn it on before any real tenant).

### Phase 4 — Frontend + RPCs (2026-10-18 →) — **in progress**
Plan (agreed): one active branch at a time, carried in the JWT; admins get a branch switcher, employees stay on their one branch; the cash account becomes an `accounts.is_cash` flag. Delivered as small PRs.

**PR 1 — database (done on `arka-staging`, branch `phase4-active-branch`):** migration `20261018155319_phase4_active_branch.sql`
- `private.active_branch_id()`: returns the JWT's `default_branch_id` claim, but only if the user still has a `user_branch_access` row for it in their org (checked live every statement). Otherwise NULL, and everything fails closed.
- The 32 `tenant_isolation` policies now require `branch_id = active_branch_id()` (was: any accessible branch). Phase 3's "all my branches at once" behaviour is superseded. `branches` still lists every accessible branch (the switcher needs them).
- `organization_id` / `branch_id` on all 32 tables now **default** from the token (`current_org_id()` / `active_branch_id()`), so inserts need not name them. This also makes `generate_salary_batch` and `apply_vendor_payment_fifo` work unchanged. An explicit `branch_id` that isn't the active branch is rejected.
- `public.set_active_branch(uuid)`: the only way a user changes their branch. `SECURITY DEFINER`, moves only the caller's own `profiles.default_branch_id`, and only to a branch they have access to in their own org (`42501` otherwise). The client must then `refreshSession()` so the hook mints a token with the new branch.
- Tests rewritten for the new rules: 56 assertions, all pass on staging; a negative control (old all-branches policy restored) fails as it should. A real-API run confirmed: defaulted inserts land in the active branch, an explicit other branch is blocked, switching works only after a token refresh, other orgs' branches are rejected, anon can't switch, and the choice survives sign-out/sign-in.

**PR 2 — frontend (done, branch `phase4-tenant-provider`):**
- `src/context/TenantContext.tsx` (`TenantProvider`/`useTenant`), mounted above the routes in `App.tsx`. It holds the org name, the branches the user can use, and the active branch, and **always takes the active branch from the access token** (the value the database uses), never from separate UI state. It reloads on every auth event, ignores out-of-date loads, and bumps an `epoch` only when the active branch actually changes (not on the hourly token refresh).
- `AdminGuard` / `EmployeeGuard` now also gate on the tenant state: a "No branch access" screen when the user has no branches, a retry screen on load errors, and `<Outlet key={epoch}>` so every screen remounts and refetches after a switch. Once the app has been shown, the guards keep it on screen if the session ends, so the screens' own "logged out"/"session expired" popups still work.
- `EmployeeGuard` now waits for the tenant to load before its "is this employee active" check, because that lookup is scoped to the active branch. Asking earlier would wrongly report an active employee as deactivated.
- `BranchSwitcher` in the admin home header: a static "Org · Branch" label for one branch, a dropdown for several. Admins only; employees have no switcher.
- `switchActiveBranch()` (RPC, then `refreshSession()`), `getAccessibleBranches()`, `getMyOrganizationName()` added to `middleware.service.ts`.
- **Self-healing:** if the token's branch is one the user can't use (e.g. access removed) but they have others, the app moves them to the first accessible one once, instead of showing an empty app.
- Verified in a real browser against `arka-staging` (4 throwaway users, removed afterwards): two-branch admin sees the dropdown, Customers shows only the active branch's customer and changes after switching; adding a customer through the **unchanged** form lands in the active branch and org; a user with no access sees the no-access screen and can sign out; a user whose token pointed at a lost branch landed in their remaining branch; an employee reached their home screen with no switcher; the logout popup still appears; no console errors. Type-checked and `npm run build` passes.

**PR 3 — cash account and branch defaults (done on `arka-staging`, branch `phase4-cash-and-defaults`):** migration `20261020093726_phase4_cash_and_defaults.sql`
- `accounts.is_cash` plus a unique index `(branch_id) where is_cash`: each branch has at most one cash account. This replaces **two** conflicting ways the app used to find it: the hardcoded `CASH_ACCOUNT_ID` UUID (the service plus six hooks/screens) and a name lookup `ilike "Cash"` in `getCashAccount()` (four service functions), which would also have broken the moment anyone named another account "cash". `CASH_ACCOUNT_ID` is gone; screens use `account.is_cash`; `getCashAccount()` filters on the flag and now throws "This branch has no cash account set up" instead of a cryptic `.single()` error; loan creation asks the database whether the chosen account `is_cash`.
- `get_daily_cash_summary` starts at the active branch's `APP_START_DATE` instead of the hardcoded `2026-04-14`. A missing or malformed value falls back to 1 January of the current year (matching the frontend's own fallback) rather than failing. The function's "today" is still hardcoded to India time.
- `product_inventory` is unique on `(branch_id, product_type)`. The app creates the BRICKS row on first use ("fetch, insert if missing"), so this protects against two overlapping requests creating two. (An earlier worry that a two-branch user could create duplicates no longer applies: since the active-branch change a user only ever sees one branch's rows.)
- `public.seed_branch_defaults(branch_id)`: what a new branch needs before its screens work. Idempotent. It creates the cash account, the `APP_START_DATE` setting (today), the `LOADING_AND_UNLOADING_PRICE_PER_BRICK` setting, and the five materials the production/metrics logic finds by name (`Wet Ash`, `Marble Powder`, `Crusher Powder`, `Fly Ash`, `Cement`; without them stock deduction is silently skipped). Stock rows and the BRICKS row are created by the app itself. Callable only by the service role / SQL editor, not by signed-in users; the Phase 5 control plane will call it. **The loading price is seeded as 0 on purpose:** the delivery screen rejects 0 with "set it in App Settings", so someone must choose the real price instead of inheriting a guess that would silently mis-pay loaders. The setting row must exist because the Settings screen only edits existing rows. Roles, expense types and vendors are not seeded; the app has no hard dependency on them by name.
- Tests: a new suite `02_branch_defaults.test.sql` (25 assertions; CI picks it up automatically): one cash account per branch, one BRICKS row per branch, seeding (including running it twice, an unknown branch, and who may call it), and the cash-summary start date for a configured, a missing and a malformed setting. All 25 pass on staging.
- Verified in a real browser against `arka-staging` with a seeded branch: the Cash Flow screen found the cash account and listed only today (the branch's start date) instead of every day since April; the Cash account was offered when creating a loan; creating a loan into Cash made the cash balance ₹5,000, recorded a CASH ledger entry in the right branch, and showed ₹5,000 cash-in on the ledger; the Settings screen listed both seeded settings with Edit buttons. The type-check from the app's entry points shows only the same 9 older errors.

**Follow-up — `increment_account_balance` now fails loudly (done on `arka-staging`, branch `phase4-increment-balance-check`):** migration `20261022051006_phase4_increment_balance_checks_account.sql`. Found in the PR 4 walkthrough.
- Symptom: calling `increment_account_balance` with an account that doesn't exist, or that belongs to another tenant, returned success and changed nothing, while `decrement_account_balance` raised `Account not found`. Observed from the Beta admin against an Acme account id: "no error", Acme's balance unchanged.
- Cause: the function is a plain `UPDATE … WHERE id = …`, and an update that matches no rows is not an error. RLS hides other tenants' accounts, so a foreign id matched nothing. Tenant data was never at risk; the harm was a silently lost increment for any caller passing a wrong or null id.
- Fix: after the update, `if not found then raise exception 'Account not found'`, the same message and behaviour as the decrement function. No app change: no database function calls it, and every app caller already checks the returned error (or, in rollback paths, logs/ignores it), so none relied on the silent success. One caller gains from it: deleting an expense restores the balance first and only then deletes the row, so a refund to a missing account used to be lost while the expense was deleted anyway; now it stops with the error.
- Tests: `03_account_balance_functions.test.sql`, 11 assertions (CI picks it up automatically): own account goes up/down; a missing, another organization's, or a null account id raises `Account not found` for **both** functions; the other organization's balance and the caller's own are unchanged afterwards. All 11 pass on staging. Negative control: with the old function body restored the three increment cases fail ("caught: no exception"); the new body was confirmed back in place afterwards.
- Still open, and now more visible: because `createCustomerPayment` inserts the payment *before* it increments the balance, a bad receiver account now shows an "Account not found" error but the payment row is already saved. That is the non-transactional-flows item from PR 4, not something this change introduced.

Still to do: PR 4, end-to-end verification in the browser (a full walkthrough of the main flows with users in two organizations).

### Phase 5+ — not started
Platform control plane → billing → ops hygiene → rollout.

## 4. Key decisions (and why)

- **One shared Supabase project, isolation by `organization_id`/`branch_id` + RLS** — not schema-per-tenant or DB-per-tenant. Cheapest to operate for "n clients"; Supabase tooling assumes it.
- **Every table gets both columns, including catalogs** (`materials`, `roles`, `expense_types`, `expense_subtypes`, `app_settings`). One uniform RLS pattern with no exceptions; cost is that a new branch starts with empty catalogs, so branch provisioning must seed them (Phase 5).
- **Composite FKs only between peer business tables.** `created_by → profiles` stays a plain FK (an actor reference, not branch-scoped data).
- **`profiles.organization_id` / `default_branch_id` stay nullable** so a platform super-admin (`is_super_admin = true`) can exist without belonging to any org.
- **Login is by email, not phone.** `profiles.phone` is only a contact field. Supabase Auth enforces `auth.users.email` uniqueness project-wide, so two orgs can never have users with the same login email.
- **Read claims from the JWT, not a second query.** `getSessionClaims()` decodes the access token already in the session.
- **The active branch is a signed claim in the token, not a client parameter or header** (Phase 4). Options weighed: pass `branch_id` on every query (~170 call sites in an untested 4,100-line file, and any forgotten read silently mixes branches), a custom request header (works, but unconventional), or the token (idiomatic for workspace switching, reuses the Phase 2 hook). Chosen: token. Known trade-off: the claim only changes on `refreshSession()`, and tabs share one session, so the UI must read the active branch from the token itself (not separate state) and refresh right after switching. A combined multi-branch view is not supported; an "all branches, read-only" mode could be added later.
- **Org from the JWT, branch access read live.** A user's org changes rarely and a stale claim lasts only until token refresh (~1h); branch access is looked up in `user_branch_access` on every query so granting/revoking takes effect immediately.
- **Normal users cannot write platform tables or `profiles`.** A self-editable `profiles` row would let anyone set `is_super_admin` or change org, and the auth hook would then mint a JWT saying so. Those writes go through the service role / SQL editor now and a super-admin control plane in Phase 5.
- **Super-admin policies are deferred to Phase 5.** A super-admin has no org, so today they see no tenant data — the safe default. Don't add a blanket bypass on tenant tables.
- **Within-branch roles are not enforced in the database.** Any user with access to a branch can read/write every tenant table for it, regardless of `profiles.role` (ADMIN/EMPLOYEE) or `branch_role` (MANAGER/STAFF). That matches how the app behaved before (UI-only gating), now bounded to the branch. Decide in Phase 4/5 whether employee-role users need narrower table access.
- **The cash account is a flag on the account (`accounts.is_cash`), unique per branch** (Phase 4 PR 3), not a hardcoded id and not a setting row. A setting would be an unchecked pointer (it could name a deleted account or another branch's, and the Settings screen lets an admin edit any value, so one mistaken edit would break every cash payment); the flag is enforced by the database and needs no extra lookup, since screens already load the branch's accounts.
- **Suspended orgs and inactive branches are not cut off yet.** `organizations.status` and `branches.status` aren't consulted by any policy; wire that in with billing (Phase 6).

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
9. **Guide vs reality drift** → `ARCHITECTURE_AND_REUSE_GUIDE.md` claims RLS protects data (it didn't — RLS was off on every table until Phase 3), documents indexes/constraints not present on `Arka demo`, and lists a `procurement_requests` table that is actually `procurements`. Trust the migrations.
10. **No type-checker in the repo** → `typescript` isn't a dependency and there's no typecheck script. `npm run build` only catches syntax/import errors, not type errors. Workaround that needs no install: `npx --yes -p typescript@5 tsc --noEmit --jsx react-jsx --target es2020 --module esnext --moduleResolution bundler --skipLibCheck --strict false --esModuleInterop --allowImportingTsExtensions --types vite/client <the files you changed>`, then look only at errors in your own files. As of Phase 4 PR 2 it reports 9 pre-existing errors in other files (`useAttendanceView`, `CreateOrderScreen`, `OrderDetailsScreen`, `useDelivery`, three `components/ui/*`), none from this work. A deliberate error confirms the checker is actually running.
11. **Supabase advisor noise** → `unused_index` is expected on empty tables. `function_search_path_mutable` (15 functions) predates this work; fix opportunistically.
12. **Migration version drift** → migrations applied through the MCP are recorded on staging with their own timestamp (e.g. `20260925192440`), but the Phase 0–2 files in the repo are named differently (`20250925000001…`, which also has the wrong year). Names match, versions don't. Harmless until someone links the CLI to staging and runs `supabase db push` / `migration list`, which will then disagree. Fix then: `supabase migration repair`, or rename the files to the recorded versions (`list_migrations` shows them). Phase 3 files were named to match from the start.
13. **User can log in but every list is empty (after Phase 3)** → the user has a `profiles` row but no `user_branch_access` row, so `accessible_branch_ids()` is empty. Fix:
    ```sql
    insert into user_branch_access (user_id, branch_id, organization_id, branch_role)
    values ('<user uid>', '<branch id>', '<that branch''s org id>', 'MANAGER');
    ```
    The org must be the branch's real org (a composite FK enforces it).
14. **Writes fail with `null value in column "organization_id"` or `"branch_id"`** → between Phase 1 and Phase 4 PR 1 this was expected (the app's inserts don't send those columns). Since Phase 4 PR 1 both columns default from the token, so a signed-in user no longer sees this (see #23 for what they see instead). It can still happen for inserts made as the table owner or service role (SQL editor, seed scripts), which have no token: pass `organization_id` and `branch_id` explicitly there.
15. **`new row violates row-level security policy`** on insert/update → the row's `organization_id` doesn't match the JWT org, or its `branch_id` isn't one the user has access to. Check the decoded JWT and the user's `user_branch_access` rows.
16. **pgTAP test errors: `WITH clause containing a data-modifying statement must be at the top level`** → you can't put `with x as (update … returning …)` inside a subquery/argument. Run the update/delete as a plain statement while impersonating the user, then assert on the data afterwards as the owner.
17. **`permission denied to set role "supabase_auth_admin"`** → the hosted SQL API's database user can't impersonate that system role, so the auth hook's behaviour under RLS can't be tested in plain SQL there. Test it with a real sign-in instead (that's what GoTrue does). The suite checks the policy exists and the hook's logic separately.
18. **Running pgTAP on a hosted project through the SQL API** → pgTAP 1.3.3 keeps no results table, and only the last statement's output is returned. Recipe: wrap each assertion as `insert into _res select is(…)`, and end the script with a `do $$ … raise exception … _get('curr_test') / _get('failed') … $$` block. The deliberate error rolls everything back, including the temporary `pgtap` extension, so nothing persists. Fixtures must never use ids that collide with `seed.sql`.
19. **Structural test "every branch_id table has `tenant_isolation`" fails for `user_branch_access`** → it has a `branch_id` column but is a platform table with its own `own_access_read` policy; the test excludes it by name. Any new platform table with `branch_id` needs the same exclusion.
20. **Test users created in the dashboard** (`test@gmail.com`, `test2@gmail.com`, from Phase 2 manual testing) have profiles but no `user_branch_access` rows, so after Phase 3 they see no business data (#13). Add rows if you want to keep using them.
21. **User logs in but sees nothing, even though they have a `user_branch_access` row (after Phase 4)** → the token's `default_branch_id` isn't a branch they have access to (or the claim is missing), so there is no active branch and everything fails closed. Decode the token and compare with `select * from user_branch_access where user_id = '<uid>'`. If it's stale, refresh the session.
22. **After `set_active_branch` the app still shows the old branch** → the token wasn't refreshed. Verified: the old token keeps scoping to the old branch until `supabase.auth.refreshSession()`. Always refresh immediately after switching, and read the active branch from the token.
23. **Insert with no `branch_id` fails with `new row violates row-level security policy` (42501), not a NOT NULL error** → there's no valid active branch, so the default is NULL; Postgres runs the RLS `WITH CHECK` before the `NOT NULL` check. Same fix as #21.
24. **Advisor warns `authenticated_security_definer_function_executable` for `public.set_active_branch`** → intentional. It must be callable by signed-in users, and it is safe because it only updates the caller's own `profiles` row after checking their access. Don't "fix" it by revoking execute.
25. **"This branch has no cash account set up. Please contact your administrator."** (or the Cash Flow screen shows no Cash card, or the Cash option is missing from a payment/loan account dropdown) → the branch has no `accounts` row with `is_cash = true`. Fix: run `select public.seed_branch_defaults('<branch id>')` (it is safe to repeat). A branch can't have two (unique index), so don't add one by hand.
26. **New branch: Settings screen is empty, or delivery says "LOADING_AND_UNLOADING_PRICE_PER_BRICK is not configured"** → the branch was created without its defaults. Run `select public.seed_branch_defaults('<branch id>')` as the table owner / service role in the SQL editor (signed-in users can't run it, by design). It seeds the loading price as `0`; delivery will keep refusing until an admin edits it to the real price in App Settings. The Settings screen can only edit rows that exist, which is why the row is seeded at all.
27. **Production entries don't reduce raw-material stock in a new branch** → the logic finds materials by name (`wet ash`, `marble`, `crusher`, `fly ash`, `cement`) and silently skips any it can't find. `seed_branch_defaults` creates all five; check `select name from materials` for the branch.
28. **Browser console shows `Failed to load resource ... 400` while testing** → don't guess; ask Supabase. Request logs record every status: `query_logs` on `edge_logs` with `toInt32OrZero(log_attributes['response.status_code']) >= 400`, filtering on `log_attributes['request.headers.referer']`. In practice the cause was auth, not data: a refresh-token 400 when the page is hard-reloaded just as the token refreshes (my rapid test reloads), and a wrong-password login. Tooling traps: `performance.getEntriesByType('resource')` hides the status of cross-origin calls (shows no failures), and patching `window.fetch` doesn't catch supabase-js, which grabs its own `fetch` at start-up.

## 6. Landmines for Phase 4 (frontend + RPCs) — read before starting

The database now enforces tenancy, but the app still behaves like a single-tenant app. Until Phase 4 the app can log in and read, but **cannot write** on a tenant-scoped project.

- ~~All 32 insert/upsert calls omit `organization_id`/`branch_id`~~ **Resolved by Phase 4 PR 1:** both columns now default from the token, so the existing inserts work unchanged once the user has a valid active branch. Callers can still pass them explicitly, but a `branch_id` other than the active one is rejected.
- ~~RPC functions that insert rows (`generate_salary_batch`, `apply_vendor_payment_fifo`) don't set org/branch~~ **Resolved the same way** (they inherit the defaults). Still worth re-testing every RPC with two orgs' data in PR 4.
- ~~`CASH_ACCOUNT_ID` is a hardcoded UUID~~ **Resolved by PR 3** (`accounts.is_cash`).
- ~~`get_daily_cash_summary` hardcodes `2026-04-14`~~ **Resolved by PR 3** (reads the branch's `APP_START_DATE`). The "today" it uses is still hardcoded to India time (`Asia/Kolkata`), as are other cash functions; revisit if a client outside India is onboarded.
- **Per-branch seeding** is now `seed_branch_defaults(branch_id)` (PR 3), but nothing calls it automatically yet: until the Phase 5 control plane exists, run it by hand for each new branch (see troubleshooting #26). It does not seed `roles`, `expense_types`, `expense_subtypes` or vendors; those are created by the admin in the app.
- ~~Review lookups by phone~~ **Reviewed in PR 2:** `checkEmployeeIsActive(phone)` still works, since phone is unique per branch and the query only sees the active branch. The fix was ordering: the employee guard now runs it only after the active branch is known.
- **`profiles.phone` is still globally unique** — it was not made branch-scoped. Fine while it isn't an auth identifier; revisit if two orgs need overlapping numbers.

Resolved in Phase 3 (kept for the record): views bypassing RLS (fixed with `security_invoker`); `supabase_auth_admin` losing access to `profiles` (read policy added and verified with a real sign-in); RLS off on every table.

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

-- RLS: tables without it (expect 0), policies (expect 37), invoker views (expect 10)
select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) as tables_without_rls,
  (select count(*) from pg_policies where schemaname='public') as policies,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v' and 'security_invoker=true' = any(c.reloptions)) as invoker_views;

-- What a given user can reach (read live by every policy)
select * from user_branch_access where user_id = '<uid>';

-- Dry-run the hook without logging in
select public.custom_access_token_hook(jsonb_build_object(
  'user_id', '<uid>', 'claims', jsonb_build_object('sub','<uid>')));
```

Decode a token in the browser console without pasting it anywhere external:
`JSON.parse(atob("<token>".split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))`
