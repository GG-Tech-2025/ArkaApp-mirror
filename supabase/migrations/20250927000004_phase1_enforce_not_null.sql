-- Phase 1, Step 8: enforce NOT NULL on organization_id/branch_id.
-- Safe as a direct ALTER since every table is empty on arka-staging today —
-- against a table with real rows this would need the nullable-add ->
-- backfill -> NOT NULL sequence Steps 5/6/8 already modeled separately.
--
-- profiles.organization_id / default_branch_id are deliberately left
-- nullable: a platform super-admin (is_super_admin = true) is not a member
-- of any client organization at all, so forcing NOT NULL there would make
-- a pure platform-operator account impossible.

alter table public.accounts alter column organization_id set not null, alter column branch_id set not null;
alter table public.customers alter column organization_id set not null, alter column branch_id set not null;
alter table public.roles alter column organization_id set not null, alter column branch_id set not null;
alter table public.employees alter column organization_id set not null, alter column branch_id set not null;
alter table public.materials alter column organization_id set not null, alter column branch_id set not null;
alter table public.vendors alter column organization_id set not null, alter column branch_id set not null;
alter table public.app_settings alter column organization_id set not null, alter column branch_id set not null;
alter table public.expense_types alter column organization_id set not null, alter column branch_id set not null;
alter table public.expense_subtypes alter column organization_id set not null, alter column branch_id set not null;
alter table public.orders alter column organization_id set not null, alter column branch_id set not null;
alter table public.customer_payments alter column organization_id set not null, alter column branch_id set not null;
alter table public.customer_writeoffs alter column organization_id set not null, alter column branch_id set not null;
alter table public.attendance alter column organization_id set not null, alter column branch_id set not null;
alter table public.salary_batches alter column organization_id set not null, alter column branch_id set not null;
alter table public.salary_ledger alter column organization_id set not null, alter column branch_id set not null;
alter table public.salary_batch_items alter column organization_id set not null, alter column branch_id set not null;
alter table public.vendor_materials alter column organization_id set not null, alter column branch_id set not null;
alter table public.inventory_stock alter column organization_id set not null, alter column branch_id set not null;
alter table public.procurements alter column organization_id set not null, alter column branch_id set not null;
alter table public.vendor_payments alter column organization_id set not null, alter column branch_id set not null;
alter table public.vendor_procurement_settlements alter column organization_id set not null, alter column branch_id set not null;
alter table public.production_entries alter column organization_id set not null, alter column branch_id set not null;
alter table public.inventory_adjustments alter column organization_id set not null, alter column branch_id set not null;
alter table public.cash_ledger_days alter column organization_id set not null, alter column branch_id set not null;
alter table public.cash_ledger_entries alter column organization_id set not null, alter column branch_id set not null;
alter table public.loans alter column organization_id set not null, alter column branch_id set not null;
alter table public.loan_ledger alter column organization_id set not null, alter column branch_id set not null;
alter table public.order_loadmen alter column organization_id set not null, alter column branch_id set not null;
alter table public.product_inventory alter column organization_id set not null, alter column branch_id set not null;
alter table public.withdrawals alter column organization_id set not null, alter column branch_id set not null;
alter table public.account_transfers alter column organization_id set not null, alter column branch_id set not null;
alter table public.expenses alter column organization_id set not null, alter column branch_id set not null;
