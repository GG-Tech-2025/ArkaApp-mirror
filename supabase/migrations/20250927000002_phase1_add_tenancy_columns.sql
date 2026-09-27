-- Phase 1, Step 5: add organization_id / branch_id to every domain table,
-- and the special profiles columns (organization_id, default_branch_id, is_super_admin).
-- Nullable for now (no NOT NULL yet) — Step 8 flips these once Step 6's test data
-- confirms the shape end-to-end. Every table gets an index on both columns since
-- Phase 3's RLS policies will filter on both (org wall + branch filter).

-- profiles is special: it identifies the platform operator flag and the user's
-- own org + default branch, not a business record scoped to one branch.
alter table public.profiles
  add column organization_id uuid null references public.organizations (id),
  add column default_branch_id uuid null references public.branches (id),
  add column is_super_admin boolean not null default false;
create index idx_profiles_organization_id on public.profiles using btree (organization_id);

-- Every other table gets the uniform pair.
alter table public.accounts
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_accounts_organization_id on public.accounts using btree (organization_id);
create index idx_accounts_branch_id on public.accounts using btree (branch_id);

alter table public.customers
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_customers_organization_id on public.customers using btree (organization_id);
create index idx_customers_branch_id on public.customers using btree (branch_id);

alter table public.roles
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_roles_organization_id on public.roles using btree (organization_id);
create index idx_roles_branch_id on public.roles using btree (branch_id);

alter table public.employees
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_employees_organization_id on public.employees using btree (organization_id);
create index idx_employees_branch_id on public.employees using btree (branch_id);

alter table public.materials
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_materials_organization_id on public.materials using btree (organization_id);
create index idx_materials_branch_id on public.materials using btree (branch_id);

alter table public.vendors
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_vendors_organization_id on public.vendors using btree (organization_id);
create index idx_vendors_branch_id on public.vendors using btree (branch_id);

alter table public.app_settings
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_app_settings_organization_id on public.app_settings using btree (organization_id);
create index idx_app_settings_branch_id on public.app_settings using btree (branch_id);

alter table public.expense_types
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_expense_types_organization_id on public.expense_types using btree (organization_id);
create index idx_expense_types_branch_id on public.expense_types using btree (branch_id);

alter table public.expense_subtypes
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_expense_subtypes_organization_id on public.expense_subtypes using btree (organization_id);
create index idx_expense_subtypes_branch_id on public.expense_subtypes using btree (branch_id);

alter table public.orders
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_orders_organization_id on public.orders using btree (organization_id);
create index idx_orders_branch_id on public.orders using btree (branch_id);

alter table public.customer_payments
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_customer_payments_organization_id on public.customer_payments using btree (organization_id);
create index idx_customer_payments_branch_id on public.customer_payments using btree (branch_id);

alter table public.customer_writeoffs
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_customer_writeoffs_organization_id on public.customer_writeoffs using btree (organization_id);
create index idx_customer_writeoffs_branch_id on public.customer_writeoffs using btree (branch_id);

alter table public.attendance
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_attendance_organization_id on public.attendance using btree (organization_id);
create index idx_attendance_branch_id on public.attendance using btree (branch_id);

alter table public.salary_batches
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_salary_batches_organization_id on public.salary_batches using btree (organization_id);
create index idx_salary_batches_branch_id on public.salary_batches using btree (branch_id);

alter table public.salary_ledger
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_salary_ledger_organization_id on public.salary_ledger using btree (organization_id);
create index idx_salary_ledger_branch_id on public.salary_ledger using btree (branch_id);

alter table public.salary_batch_items
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_salary_batch_items_organization_id on public.salary_batch_items using btree (organization_id);
create index idx_salary_batch_items_branch_id on public.salary_batch_items using btree (branch_id);

alter table public.vendor_materials
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_vendor_materials_organization_id on public.vendor_materials using btree (organization_id);
create index idx_vendor_materials_branch_id on public.vendor_materials using btree (branch_id);

alter table public.inventory_stock
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_inventory_stock_organization_id on public.inventory_stock using btree (organization_id);
create index idx_inventory_stock_branch_id on public.inventory_stock using btree (branch_id);

alter table public.procurements
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_procurements_organization_id on public.procurements using btree (organization_id);
create index idx_procurements_branch_id on public.procurements using btree (branch_id);

alter table public.vendor_payments
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_vendor_payments_organization_id on public.vendor_payments using btree (organization_id);
create index idx_vendor_payments_branch_id on public.vendor_payments using btree (branch_id);

alter table public.vendor_procurement_settlements
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_vendor_procurement_settlements_organization_id on public.vendor_procurement_settlements using btree (organization_id);
create index idx_vendor_procurement_settlements_branch_id on public.vendor_procurement_settlements using btree (branch_id);

alter table public.production_entries
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_production_entries_organization_id on public.production_entries using btree (organization_id);
create index idx_production_entries_branch_id on public.production_entries using btree (branch_id);

alter table public.inventory_adjustments
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_inventory_adjustments_organization_id on public.inventory_adjustments using btree (organization_id);
create index idx_inventory_adjustments_branch_id on public.inventory_adjustments using btree (branch_id);

alter table public.cash_ledger_days
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_cash_ledger_days_organization_id on public.cash_ledger_days using btree (organization_id);
create index idx_cash_ledger_days_branch_id on public.cash_ledger_days using btree (branch_id);

alter table public.cash_ledger_entries
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_cash_ledger_entries_organization_id on public.cash_ledger_entries using btree (organization_id);
create index idx_cash_ledger_entries_branch_id on public.cash_ledger_entries using btree (branch_id);

alter table public.loans
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_loans_organization_id on public.loans using btree (organization_id);
create index idx_loans_branch_id on public.loans using btree (branch_id);

alter table public.loan_ledger
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_loan_ledger_organization_id on public.loan_ledger using btree (organization_id);
create index idx_loan_ledger_branch_id on public.loan_ledger using btree (branch_id);

alter table public.order_loadmen
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_order_loadmen_organization_id on public.order_loadmen using btree (organization_id);
create index idx_order_loadmen_branch_id on public.order_loadmen using btree (branch_id);

alter table public.product_inventory
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_product_inventory_organization_id on public.product_inventory using btree (organization_id);
create index idx_product_inventory_branch_id on public.product_inventory using btree (branch_id);

alter table public.withdrawals
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_withdrawals_organization_id on public.withdrawals using btree (organization_id);
create index idx_withdrawals_branch_id on public.withdrawals using btree (branch_id);

alter table public.account_transfers
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_account_transfers_organization_id on public.account_transfers using btree (organization_id);
create index idx_account_transfers_branch_id on public.account_transfers using btree (branch_id);

alter table public.expenses
  add column organization_id uuid null references public.organizations (id),
  add column branch_id uuid null references public.branches (id);
create index idx_expenses_organization_id on public.expenses using btree (organization_id);
create index idx_expenses_branch_id on public.expenses using btree (branch_id);
