# ArkaApp

React + Vite + Supabase app with an Employee app, an Admin app and a platform tool.

## Testing is part of every change

After any change to app code, write or update tests in the same change, without being asked.
Do not report a task as done until both suites pass.

- **Unit tests (Vitest + Testing Library):** put them next to the file, as `Foo.test.tsx`.
  Mock `src/services/middleware.service` instead of calling Supabase.
  Run: `npm test`
- **End-to-end tests (Playwright):** put them in `e2e/*.spec.ts`.
  Use `mockSupabase` from `e2e/support/supabase-mock.ts`; e2e runs must never reach a real
  Supabase project. Extend that mock when a flow needs a new endpoint.
  Run: `npm run test:e2e`

What to cover:
- A bug fix gets a test that fails without the fix.
- A new or changed screen gets tests for the happy path, validation and error messages,
  disabled/enabled states, redirects, and role or permission checks.
- A change to Supabase functions or migrations gets a pgTAP test in `supabase/tests/database/`.

Writing good tests:
- Query by role and label (`getByRole`, `getByLabel`), not CSS classes.
- Assert the visible outcome, such as the message shown or the URL reached, not implementation details.
- Do not change a test just to make it pass. If a test fails, work out whether the app or the test is wrong.
- Never put real credentials in tests; use the placeholders in the mock.

## Database

- Schema changes go in `supabase/migrations/` and are applied to arka-staging, not the demo project, unless told otherwise.
- An employee login needs three things: an auth user, a `profiles` row, and an `employees` row
  whose `phone` matches the profile and whose `active` is true. Without the `employees` row the
  Employee app signs the user out with "account deactivated".
