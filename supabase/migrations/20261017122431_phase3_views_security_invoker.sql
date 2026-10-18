-- Phase 3, Step 4: make every view run with the caller's permissions.
--
-- Views default to running as their owner, which bypasses RLS on the tables
-- underneath. Without this, customer_financials and friends would keep
-- returning every organization's rows even with RLS on the base tables.
-- security_invoker (Postgres 15+) applies the querying user's RLS instead.

alter view public.customer_financials set (security_invoker = true);
alter view public.customer_order_settlement set (security_invoker = true);
alter view public.customer_payments_view set (security_invoker = true);
alter view public.customer_writeoffs_view set (security_invoker = true);
alter view public.employee_with_balance set (security_invoker = true);
alter view public.order_running_totals set (security_invoker = true);
alter view public.payment_running_totals set (security_invoker = true);
alter view public.total_withdrawals_view set (security_invoker = true);
alter view public.vendor_financials set (security_invoker = true);
alter view public.vendor_procurement_settlement set (security_invoker = true);
