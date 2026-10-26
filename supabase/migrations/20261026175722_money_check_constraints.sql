-- Money sanity rules enforced by the database itself, not just by the app.
--
-- Each constraint is added NOT VALID: it is enforced for every new or changed row straight
-- away, but existing rows are not scanned, so this migration cannot fail on old data. The
-- staging project had no violating rows when this was written; once the same is confirmed
-- for every environment, run the VALIDATE statements at the bottom (separately, they only
-- take a light lock).

alter table public.expenses
  add constraint expenses_amount_positive check (amount > 0) not valid;

alter table public.vendor_payments
  add constraint vendor_payments_amount_positive check (amount > 0) not valid;

alter table public.customer_payments
  add constraint customer_payments_amount_positive check (amount > 0) not valid;

-- withdrawals.amount is nullable; a NULL passes a CHECK, a zero or negative amount does not.
alter table public.withdrawals
  add constraint withdrawals_amount_positive check (amount > 0) not valid;

alter table public.account_transfers
  add constraint account_transfers_distinct_accounts
  check (sender_account_id <> receiver_account_id) not valid;

alter table public.loans
  add constraint loans_outstanding_balance_nonnegative check (outstanding_balance >= 0) not valid;

-- An account can never go below zero. decrement_account_balance already refuses it; this
-- also covers anything that updates balance directly. NOTE: reverse_customer_payment
-- subtracts a payment from the receiving account without checking, so reversing a payment
-- whose money has since been spent will now fail with a check violation instead of leaving
-- a negative balance. Drop this one if negative balances must stay possible.
alter table public.accounts
  add constraint accounts_balance_nonnegative check (balance >= 0) not valid;

-- After confirming no environment has violating rows:
-- alter table public.expenses           validate constraint expenses_amount_positive;
-- alter table public.vendor_payments    validate constraint vendor_payments_amount_positive;
-- alter table public.customer_payments  validate constraint customer_payments_amount_positive;
-- alter table public.withdrawals        validate constraint withdrawals_amount_positive;
-- alter table public.account_transfers  validate constraint account_transfers_distinct_accounts;
-- alter table public.loans              validate constraint loans_outstanding_balance_nonnegative;
-- alter table public.accounts           validate constraint accounts_balance_nonnegative;
