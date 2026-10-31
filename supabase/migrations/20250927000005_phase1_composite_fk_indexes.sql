-- Phase 1 follow-up: composite indexes matching each (col, branch_id) FK exactly,
-- per Supabase's performance advisor (unindexed_foreign_keys) run right after
-- Step 7/8 landed. The single-column organization_id/branch_id indexes added in
-- Step 5 stay (useful for plain RLS equality filters); these are additive,
-- covering the FK's own lookup/cascade pattern and joins that filter on both
-- columns together. Also covers the handful of plain (non-composite) FKs the
-- advisor flagged: created_by columns, profiles.default_branch_id,
-- user_branch_access.organization_id.

create index idx_account_transfers_receiver_branch on public.account_transfers using btree (receiver_account_id, branch_id);
create index idx_account_transfers_sender_branch on public.account_transfers using btree (sender_account_id, branch_id);
create index idx_attendance_employee_branch on public.attendance using btree (employee_id, branch_id);
create index idx_cash_ledger_entries_account_branch on public.cash_ledger_entries using btree (account_id, branch_id);
create index idx_cash_ledger_entries_ledger_day_branch on public.cash_ledger_entries using btree (ledger_day_id, branch_id);
create index idx_customer_payments_customer_branch on public.customer_payments using btree (customer_id, branch_id);
create index idx_customer_payments_order_branch on public.customer_payments using btree (order_id, branch_id);
create index idx_customer_payments_receiver_account_branch on public.customer_payments using btree (receiver_account_id, branch_id);
create index idx_customer_writeoffs_customer_branch on public.customer_writeoffs using btree (customer_id, branch_id);
create index idx_employees_role_branch on public.employees using btree (role_id, branch_id);
create index idx_expense_subtypes_type_branch on public.expense_subtypes using btree (type_id, branch_id);
create index idx_expenses_sender_account_branch on public.expenses using btree (sender_account_id, branch_id);
create index idx_expenses_subtype_branch on public.expenses using btree (subtype_id, branch_id);
create index idx_expenses_type_branch on public.expenses using btree (type_id, branch_id);
create index idx_inventory_stock_material_branch on public.inventory_stock using btree (material_id, branch_id);
create index idx_loan_ledger_loan_branch on public.loan_ledger using btree (loan_id, branch_id);
create index idx_loan_ledger_sender_account_branch on public.loan_ledger using btree (sender_account_id, branch_id);
create index idx_loans_disbursement_account_branch on public.loans using btree (disbursement_account_id, branch_id);
create index idx_order_loadmen_employee_branch on public.order_loadmen using btree (employee_id, branch_id);
create index idx_order_loadmen_order_branch on public.order_loadmen using btree (order_id, branch_id);
create index idx_orders_customer_branch on public.orders using btree (customer_id, branch_id);
create index idx_procurements_material_branch on public.procurements using btree (material_id, branch_id);
create index idx_procurements_vendor_branch on public.procurements using btree (vendor_id, branch_id);
create index idx_salary_batch_items_batch_branch on public.salary_batch_items using btree (batch_id, branch_id);
create index idx_salary_batch_items_employee_branch on public.salary_batch_items using btree (employee_id, branch_id);
create index idx_salary_ledger_employee_branch on public.salary_ledger using btree (employee_id, branch_id);
create index idx_salary_ledger_sender_account_branch on public.salary_ledger using btree (sender_account_id, branch_id);
create index idx_vendor_materials_material_branch on public.vendor_materials using btree (material_id, branch_id);
create index idx_vendor_materials_vendor_branch on public.vendor_materials using btree (vendor_id, branch_id);
create index idx_vendor_payments_sender_account_branch on public.vendor_payments using btree (sender_account_id, branch_id);
create index idx_vendor_payments_vendor_branch on public.vendor_payments using btree (vendor_id, branch_id);
create index idx_vps_procurement_branch on public.vendor_procurement_settlements using btree (procurement_id, branch_id);
create index idx_vps_vendor_payment_branch on public.vendor_procurement_settlements using btree (vendor_payment_id, branch_id);
create index idx_withdrawals_account_branch on public.withdrawals using btree (account_id, branch_id);

-- plain (non-composite) FKs the advisor also flagged
create index idx_inventory_adjustments_created_by on public.inventory_adjustments using btree (created_by);
create index idx_orders_created_by on public.orders using btree (created_by);
create index idx_procurements_created_by on public.procurements using btree (created_by);
create index idx_production_entries_created_by on public.production_entries using btree (created_by);
create index idx_profiles_default_branch_id on public.profiles using btree (default_branch_id);
create index idx_user_branch_access_organization_id on public.user_branch_access using btree (organization_id);
