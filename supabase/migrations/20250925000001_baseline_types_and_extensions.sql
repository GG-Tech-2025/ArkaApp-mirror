-- Baseline migration 1/4: extensions + enum types
-- Reconstructed from the live "Arka demo" Supabase project (icnxulbrbkhcfatepexb)
-- as of 2026-09-25, cross-checked against ARCHITECTURE_AND_REUSE_GUIDE.md.

create extension if not exists pgcrypto with schema extensions;

create type public.payment_status as enum ('NOT_PAID', 'PARTIALLY_PAID', 'FULLY_PAID');
create type public.payment_mode as enum ('CASH', 'BANK', 'UPI', 'CHEQUE');
create type public.attendance_status as enum ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');
create type public.salary_entry_type as enum (
  'ADVANCE', 'WEEKLY', 'EMERGENCY', 'DAILY', 'PARTIAL_SETTLEMENT',
  'FULL_SETTLEMENT', 'AUTO', 'SALARY_AUTO_ENTRY', 'DEDUCTION', 'SALARY_MANUAL_ENTRY'
);
create type public.employee_category as enum ('DAILY', 'FIXED', 'LOADMEN');
create type public.loan_type as enum ('OWNER', 'BANK', 'SHORT_TERM');
create type public.loan_status as enum ('ACTIVE', 'CLOSED');
create type public.loan_transaction_type as enum ('DISBURSEMENT', 'REPAYMENT', 'INTEREST');
create type public.cash_day_status as enum ('OPEN', 'FROZEN');
create type public.cash_direction as enum ('IN', 'OUT');
create type public.cash_in_source as enum ('CUSTOMER_PAYMENT', 'LOAN_DISBURSEMENT', 'OWNER_CAPITAL');
create type public.cash_out_type as enum (
  'VENDOR_PAYMENT', 'SALARY_PAYMENT', 'EXPENSE_PAYMENT', 'LOAN_REPAYMENT',
  'INTEREST_PAYMENT', 'OWNER_WITHDRAWAL', 'ASSET_PURCHASE', 'CASH_WITHDRAWAL'
);
