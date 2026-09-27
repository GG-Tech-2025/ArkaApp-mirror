-- Phase 1, Step 7: branch-scoped constraints.
--
-- Three things happen here, in dependency order:
--   A. Add UNIQUE(id, branch_id) on every table that is referenced by another
--      table's FK, so a composite FK can point at it.
--   B. For every FK between two branch-scoped business tables, drop the plain
--      single-column FK and replace it with a composite (fk_col, branch_id)
--      FK — so a child can never point at a parent in a different branch,
--      even if the app has a bug. `created_by -> profiles` columns are left
--      untouched: they're actor references (who did this), not a branch-
--      scoped business relationship, so they don't get this treatment.
--   C. Convert global UNIQUE constraints that are actually per-branch business
--      rules (a phone number, a settings key, a ledger date) into
--      (branch_id, ...) composites, so two different branches can reuse the
--      same value independently. profiles.phone is deliberately NOT touched
--      here — it's the Supabase Auth login identifier and stays globally
--      unique across the whole project; see Phase 2 (Auth) for that discussion.

-- ============================================================
-- A. UNIQUE(id, branch_id) on every referenced parent table
-- ============================================================

alter table public.customers add constraint customers_id_branch_key unique (id, branch_id);
alter table public.orders add constraint orders_id_branch_key unique (id, branch_id);
alter table public.employees add constraint employees_id_branch_key unique (id, branch_id);
alter table public.roles add constraint roles_id_branch_key unique (id, branch_id);
alter table public.accounts add constraint accounts_id_branch_key unique (id, branch_id);
alter table public.vendors add constraint vendors_id_branch_key unique (id, branch_id);
alter table public.materials add constraint materials_id_branch_key unique (id, branch_id);
alter table public.salary_batches add constraint salary_batches_id_branch_key unique (id, branch_id);
alter table public.procurements add constraint procurements_id_branch_key unique (id, branch_id);
alter table public.vendor_payments add constraint vendor_payments_id_branch_key unique (id, branch_id);
alter table public.cash_ledger_days add constraint cash_ledger_days_id_branch_key unique (id, branch_id);
alter table public.loans add constraint loans_id_branch_key unique (id, branch_id);
alter table public.expense_types add constraint expense_types_id_branch_key unique (id, branch_id);
alter table public.expense_subtypes add constraint expense_subtypes_id_branch_key unique (id, branch_id);

-- ============================================================
-- B. Composite FKs (drop plain FK, add branch-composite FK)
-- ============================================================

-- orders.customer_id -> customers
alter table public.orders drop constraint orders_customer_id_fkey;
alter table public.orders add constraint orders_customer_id_branch_fkey
  foreign key (customer_id, branch_id) references public.customers (id, branch_id);

-- customer_payments.customer_id -> customers
alter table public.customer_payments drop constraint customer_payments_customer_id_fkey;
alter table public.customer_payments add constraint customer_payments_customer_id_branch_fkey
  foreign key (customer_id, branch_id) references public.customers (id, branch_id);

-- customer_payments.order_id -> orders
alter table public.customer_payments drop constraint customer_payments_order_id_fkey;
alter table public.customer_payments add constraint customer_payments_order_id_branch_fkey
  foreign key (order_id, branch_id) references public.orders (id, branch_id);

-- customer_payments.receiver_account_id -> accounts
alter table public.customer_payments drop constraint customer_payments_receiver_account_id_fkey;
alter table public.customer_payments add constraint customer_payments_receiver_account_id_branch_fkey
  foreign key (receiver_account_id, branch_id) references public.accounts (id, branch_id);

-- customer_writeoffs.customer_id -> customers
alter table public.customer_writeoffs drop constraint customer_writeoffs_customer_id_fkey;
alter table public.customer_writeoffs add constraint customer_writeoffs_customer_id_branch_fkey
  foreign key (customer_id, branch_id) references public.customers (id, branch_id);

-- employees.role_id -> roles
alter table public.employees drop constraint employees_role_id_fkey;
alter table public.employees add constraint employees_role_id_branch_fkey
  foreign key (role_id, branch_id) references public.roles (id, branch_id);

-- attendance.employee_id -> employees
alter table public.attendance drop constraint attendance_employee_id_fkey;
alter table public.attendance add constraint attendance_employee_id_branch_fkey
  foreign key (employee_id, branch_id) references public.employees (id, branch_id);

-- salary_ledger.employee_id -> employees
alter table public.salary_ledger drop constraint salary_ledger_employee_id_fkey;
alter table public.salary_ledger add constraint salary_ledger_employee_id_branch_fkey
  foreign key (employee_id, branch_id) references public.employees (id, branch_id);

-- salary_ledger.sender_account_id -> accounts
alter table public.salary_ledger drop constraint salary_ledger_sender_account_id_fkey;
alter table public.salary_ledger add constraint salary_ledger_sender_account_id_branch_fkey
  foreign key (sender_account_id, branch_id) references public.accounts (id, branch_id);

-- salary_batch_items.batch_id -> salary_batches (preserve ON DELETE CASCADE)
alter table public.salary_batch_items drop constraint salary_batch_items_batch_id_fkey;
alter table public.salary_batch_items add constraint salary_batch_items_batch_id_branch_fkey
  foreign key (batch_id, branch_id) references public.salary_batches (id, branch_id) on delete cascade;

-- salary_batch_items.employee_id -> employees
alter table public.salary_batch_items drop constraint salary_batch_items_employee_id_fkey;
alter table public.salary_batch_items add constraint salary_batch_items_employee_id_branch_fkey
  foreign key (employee_id, branch_id) references public.employees (id, branch_id);

-- vendor_materials.vendor_id -> vendors
alter table public.vendor_materials drop constraint vendor_materials_vendor_id_fkey;
alter table public.vendor_materials add constraint vendor_materials_vendor_id_branch_fkey
  foreign key (vendor_id, branch_id) references public.vendors (id, branch_id);

-- vendor_materials.material_id -> materials
alter table public.vendor_materials drop constraint vendor_materials_material_id_fkey;
alter table public.vendor_materials add constraint vendor_materials_material_id_branch_fkey
  foreign key (material_id, branch_id) references public.materials (id, branch_id);

-- inventory_stock.material_id -> materials (inventory_stock's PK IS material_id)
alter table public.inventory_stock drop constraint inventory_stock_material_id_fkey;
alter table public.inventory_stock add constraint inventory_stock_material_id_branch_fkey
  foreign key (material_id, branch_id) references public.materials (id, branch_id);

-- procurements.material_id -> materials
alter table public.procurements drop constraint procurements_material_id_fkey;
alter table public.procurements add constraint procurements_material_id_branch_fkey
  foreign key (material_id, branch_id) references public.materials (id, branch_id);

-- procurements.vendor_id -> vendors
alter table public.procurements drop constraint procurements_vendor_id_fkey;
alter table public.procurements add constraint procurements_vendor_id_branch_fkey
  foreign key (vendor_id, branch_id) references public.vendors (id, branch_id);

-- vendor_payments.vendor_id -> vendors
alter table public.vendor_payments drop constraint vendor_payments_vendor_id_fkey;
alter table public.vendor_payments add constraint vendor_payments_vendor_id_branch_fkey
  foreign key (vendor_id, branch_id) references public.vendors (id, branch_id);

-- vendor_payments.sender_account_id -> accounts
alter table public.vendor_payments drop constraint vendor_payments_sender_account_id_fkey;
alter table public.vendor_payments add constraint vendor_payments_sender_account_id_branch_fkey
  foreign key (sender_account_id, branch_id) references public.accounts (id, branch_id);

-- vendor_procurement_settlements.procurement_id -> procurements
alter table public.vendor_procurement_settlements drop constraint vendor_procurement_settlements_procurement_id_fkey;
alter table public.vendor_procurement_settlements add constraint vendor_procurement_settlements_procurement_id_branch_fkey
  foreign key (procurement_id, branch_id) references public.procurements (id, branch_id);

-- vendor_procurement_settlements.vendor_payment_id -> vendor_payments
alter table public.vendor_procurement_settlements drop constraint vendor_procurement_settlements_vendor_payment_id_fkey;
alter table public.vendor_procurement_settlements add constraint vendor_procurement_settlements_vendor_payment_id_branch_fkey
  foreign key (vendor_payment_id, branch_id) references public.vendor_payments (id, branch_id);

-- cash_ledger_entries.ledger_day_id -> cash_ledger_days
alter table public.cash_ledger_entries drop constraint cash_ledger_entries_ledger_day_id_fkey;
alter table public.cash_ledger_entries add constraint cash_ledger_entries_ledger_day_id_branch_fkey
  foreign key (ledger_day_id, branch_id) references public.cash_ledger_days (id, branch_id);

-- cash_ledger_entries.account_id -> accounts
alter table public.cash_ledger_entries drop constraint cash_ledger_entries_account_id_fkey;
alter table public.cash_ledger_entries add constraint cash_ledger_entries_account_id_branch_fkey
  foreign key (account_id, branch_id) references public.accounts (id, branch_id);

-- loans.disbursement_account_id -> accounts
alter table public.loans drop constraint loans_disbursement_account_id_fkey;
alter table public.loans add constraint loans_disbursement_account_id_branch_fkey
  foreign key (disbursement_account_id, branch_id) references public.accounts (id, branch_id);

-- loan_ledger.loan_id -> loans
alter table public.loan_ledger drop constraint loan_ledger_loan_id_fkey;
alter table public.loan_ledger add constraint loan_ledger_loan_id_branch_fkey
  foreign key (loan_id, branch_id) references public.loans (id, branch_id);

-- loan_ledger.sender_account_id -> accounts
alter table public.loan_ledger drop constraint loan_ledger_sender_account_id_fkey;
alter table public.loan_ledger add constraint loan_ledger_sender_account_id_branch_fkey
  foreign key (sender_account_id, branch_id) references public.accounts (id, branch_id);

-- order_loadmen.order_id -> orders (preserve ON DELETE CASCADE)
alter table public.order_loadmen drop constraint order_loadmen_order_id_fkey;
alter table public.order_loadmen add constraint order_loadmen_order_id_branch_fkey
  foreign key (order_id, branch_id) references public.orders (id, branch_id) on delete cascade;

-- order_loadmen.employee_id -> employees (preserve ON DELETE CASCADE)
alter table public.order_loadmen drop constraint order_loadmen_employee_id_fkey;
alter table public.order_loadmen add constraint order_loadmen_employee_id_branch_fkey
  foreign key (employee_id, branch_id) references public.employees (id, branch_id) on delete cascade;

-- withdrawals.account_id -> accounts
alter table public.withdrawals drop constraint withdrawals_account_id_fkey;
alter table public.withdrawals add constraint withdrawals_account_id_branch_fkey
  foreign key (account_id, branch_id) references public.accounts (id, branch_id);

-- account_transfers.sender_account_id -> accounts
alter table public.account_transfers drop constraint fk_sender_account;
alter table public.account_transfers add constraint account_transfers_sender_account_id_branch_fkey
  foreign key (sender_account_id, branch_id) references public.accounts (id, branch_id);

-- account_transfers.receiver_account_id -> accounts
alter table public.account_transfers drop constraint fk_receiver_account;
alter table public.account_transfers add constraint account_transfers_receiver_account_id_branch_fkey
  foreign key (receiver_account_id, branch_id) references public.accounts (id, branch_id);

-- expenses.type_id -> expense_types
alter table public.expenses drop constraint expenses_type_id_fkey;
alter table public.expenses add constraint expenses_type_id_branch_fkey
  foreign key (type_id, branch_id) references public.expense_types (id, branch_id);

-- expenses.subtype_id -> expense_subtypes
alter table public.expenses drop constraint expenses_subtype_id_fkey;
alter table public.expenses add constraint expenses_subtype_id_branch_fkey
  foreign key (subtype_id, branch_id) references public.expense_subtypes (id, branch_id);

-- expenses.sender_account_id -> accounts
alter table public.expenses drop constraint expenses_sender_account_id_fkey;
alter table public.expenses add constraint expenses_sender_account_id_branch_fkey
  foreign key (sender_account_id, branch_id) references public.accounts (id, branch_id);

-- expense_subtypes.type_id -> expense_types
alter table public.expense_subtypes drop constraint expense_subtypes_type_id_fkey;
alter table public.expense_subtypes add constraint expense_subtypes_type_id_branch_fkey
  foreign key (type_id, branch_id) references public.expense_types (id, branch_id);

-- ============================================================
-- C. Branch-scoped UNIQUE constraints (replace global uniques)
-- ============================================================

alter table public.customers drop constraint customers_phone_key;
alter table public.customers add constraint customers_branch_phone_key unique (branch_id, phone);

alter table public.employees drop constraint employees_phone_key;
alter table public.employees add constraint employees_branch_phone_key unique (branch_id, phone);

alter table public.app_settings drop constraint app_settings_key_key;
alter table public.app_settings add constraint app_settings_branch_key_key unique (branch_id, key);

alter table public.salary_batches drop constraint salary_batches_month_key;
alter table public.salary_batches add constraint salary_batches_branch_month_key unique (branch_id, month);

alter table public.cash_ledger_days drop constraint cash_ledger_days_ledger_date_key;
alter table public.cash_ledger_days add constraint cash_ledger_days_branch_ledger_date_key unique (branch_id, ledger_date);

alter table public.expense_types drop constraint expense_types_name_key;
alter table public.expense_types add constraint expense_types_branch_name_key unique (branch_id, name);

alter table public.expense_subtypes drop constraint expense_subtypes_type_id_name_key;
alter table public.expense_subtypes add constraint expense_subtypes_branch_type_name_key unique (branch_id, type_id, name);
