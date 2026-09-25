-- Baseline migration 2/4: tables, constraints, indexes
-- Reconstructed from the live "Arka demo" Supabase project (icnxulbrbkhcfatepexb) as of 2026-09-25.
-- Column lengths (varchar sizes) taken from ARCHITECTURE_AND_REUSE_GUIDE.md where the live
-- API did not expose them. Includes two documented-but-not-yet-applied items on this project:
-- the (type_id, name) unique constraint on expense_subtypes, and two salary_ledger search indexes.

create table public.profiles (
  id uuid not null,
  phone character varying(10) not null,
  role text not null,
  created_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_phone_key unique (phone),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_role_check check (role = any (array['ADMIN'::text, 'EMPLOYEE'::text]))
);

create table public.accounts (
  id uuid not null default gen_random_uuid(),
  account_number text not null,
  opening_balance numeric null default 0,
  created_at timestamp with time zone null default now(),
  balance numeric not null default 0,
  constraint accounts_pkey primary key (id)
);

create table public.customers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone character varying(10) not null,
  gst_number character varying(15) null,
  address text null,
  created_at timestamp with time zone null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_phone_key unique (phone)
);

create table public.roles (
  id uuid not null default gen_random_uuid(),
  name text not null,
  category public.employee_category not null,
  salary_value numeric not null,
  active boolean null default true,
  minimum_requirement text null,
  no_loading_salary boolean not null default false,
  constraint roles_pkey primary key (id)
);

create table public.employees (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone character varying(10) not null,
  alternate_phone character varying(10) null,
  blood_group text null,
  aadhar character varying(12) null,
  permanent_address text null,
  local_address text null,
  role_id uuid null,
  emergency_contact_name text null,
  emergency_contact_phone character varying(10) null,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  deduction_amount numeric null,
  constraint employees_pkey primary key (id),
  constraint employees_phone_key unique (phone),
  constraint employees_role_id_fkey foreign key (role_id) references public.roles (id)
);
create index idx_employee_name on public.employees using btree (name);

create table public.materials (
  id uuid not null default gen_random_uuid(),
  name text not null,
  unit text not null,
  constraint materials_pkey primary key (id)
);

create table public.vendors (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone character varying(10) null,
  alternate_phone character varying(10) null,
  gst_number character varying(15) null,
  address text null,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint vendors_pkey primary key (id)
);

create table public.app_settings (
  id uuid not null default gen_random_uuid(),
  key character varying(255) not null,
  value text not null,
  description text null,
  updated_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  constraint app_settings_pkey primary key (id),
  constraint app_settings_key_key unique (key)
);
comment on table public.app_settings is 'Application-wide configuration settings';

create table public.expense_types (
  id uuid not null default gen_random_uuid(),
  name text not null,
  constraint expense_types_pkey primary key (id),
  constraint expense_types_name_key unique (name)
);

create table public.expense_subtypes (
  id uuid not null default gen_random_uuid(),
  type_id uuid null,
  name text not null,
  constraint expense_subtypes_pkey primary key (id),
  constraint expense_subtypes_type_id_name_key unique (type_id, name),
  constraint expense_subtypes_type_id_fkey foreign key (type_id) references public.expense_types (id)
);

create table public.orders (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  order_date date not null,
  delivery_date date not null,
  brick_quantity integer not null,
  price_per_brick numeric null,
  paper_price numeric null,
  final_price numeric not null,
  location text null,
  payment_status public.payment_status null default 'NOT_PAID'::public.payment_status,
  amount_paid numeric null default 0,
  written_off_amount numeric not null default 0,
  gst_number character varying(15) null,
  dc_number text null,
  delivered boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  time text null,
  loading_type text null,
  constraint orders_pkey primary key (id),
  constraint orders_created_by_fkey foreign key (created_by) references public.profiles (id),
  constraint orders_customer_id_fkey foreign key (customer_id) references public.customers (id),
  constraint orders_loading_type_check check (
    loading_type = any (array['LOADING_ONLY'::text, 'LOADING_UNLOADING'::text, 'CUSTOMER_SELF'::text])
  )
);

create table public.customer_payments (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  order_id uuid null,
  payment_date date not null,
  amount numeric not null,
  mode public.payment_mode not null,
  created_at timestamp with time zone null default now(),
  receiver_account_id uuid null,
  sender_account_no text null,
  constraint customer_payments_pkey primary key (id),
  constraint customer_payments_customer_id_fkey foreign key (customer_id) references public.customers (id),
  constraint customer_payments_order_id_fkey foreign key (order_id) references public.orders (id),
  constraint customer_payments_receiver_account_id_fkey foreign key (receiver_account_id) references public.accounts (id)
);

create table public.customer_writeoffs (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  amount numeric not null,
  reason text not null,
  write_off_date date not null default current_date,
  created_at timestamp with time zone not null default now(),
  constraint customer_writeoffs_pkey primary key (id),
  constraint customer_writeoffs_amount_check check (amount > 0),
  constraint customer_writeoffs_customer_id_fkey foreign key (customer_id) references public.customers (id)
);

create table public.attendance (
  employee_id uuid not null,
  date date not null,
  status public.attendance_status not null,
  constraint attendance_pkey primary key (employee_id, date),
  constraint attendance_employee_id_fkey foreign key (employee_id) references public.employees (id)
);

create table public.salary_batches (
  id uuid not null default gen_random_uuid(),
  month date not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  status text null default 'DRAFT'::text,
  constraint salary_batches_pkey primary key (id),
  constraint salary_batches_month_key unique (month),
  constraint salary_batches_status_check check (status = any (array['DRAFT'::text, 'GENERATED'::text]))
);

create table public.salary_ledger (
  id uuid not null default gen_random_uuid(),
  employee_id uuid null,
  entry_type public.salary_entry_type not null,
  amount numeric not null,
  running_balance numeric not null,
  payment_mode public.payment_mode null,
  sender_account_id uuid null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  receiver_account text null,
  salary_batch_id uuid null,
  payment_at timestamp with time zone null default now(),
  constraint salary_ledger_pkey primary key (id),
  constraint salary_ledger_employee_id_fkey foreign key (employee_id) references public.employees (id),
  constraint salary_ledger_sender_account_id_fkey foreign key (sender_account_id) references public.accounts (id)
);
create index idx_salary_ledger_employee_payment_at on public.salary_ledger using btree (employee_id, payment_at desc);
create index idx_salary_ledger_employee_created on public.salary_ledger using btree (employee_id, created_at desc);

create table public.salary_batch_items (
  id uuid not null default gen_random_uuid(),
  batch_id uuid null,
  employee_id uuid null,
  present_days integer null default 0,
  absent_days integer null default 0,
  leave_days integer null default 0,
  half_days integer null default 0,
  base_salary numeric not null,
  final_salary numeric not null,
  created_at timestamp with time zone null default now(),
  constraint salary_batch_items_pkey primary key (id),
  constraint salary_batch_items_batch_id_employee_id_key unique (batch_id, employee_id),
  constraint salary_batch_items_batch_id_fkey foreign key (batch_id) references public.salary_batches (id) on delete cascade,
  constraint salary_batch_items_employee_id_fkey foreign key (employee_id) references public.employees (id)
);

create table public.vendor_materials (
  vendor_id uuid not null,
  material_id uuid not null,
  constraint vendor_materials_pkey primary key (vendor_id, material_id),
  constraint vendor_materials_material_id_fkey foreign key (material_id) references public.materials (id),
  constraint vendor_materials_vendor_id_fkey foreign key (vendor_id) references public.vendors (id)
);

create table public.inventory_stock (
  material_id uuid not null,
  quantity numeric not null,
  updated_at timestamp with time zone null default now(),
  constraint inventory_stock_pkey primary key (material_id),
  constraint inventory_stock_material_id_fkey foreign key (material_id) references public.materials (id)
);

create table public.procurements (
  id uuid not null default gen_random_uuid(),
  material_id uuid null,
  vendor_id uuid null,
  quantity numeric not null,
  rate_per_unit numeric not null,
  total_price numeric not null,
  date date not null,
  approved boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  payment_status text null default 'NOT_PAID'::text,
  total_paid numeric null default 0,
  constraint procurements_pkey primary key (id),
  constraint procurements_created_by_fkey foreign key (created_by) references public.profiles (id),
  constraint procurements_material_id_fkey foreign key (material_id) references public.materials (id),
  constraint procurements_vendor_id_fkey foreign key (vendor_id) references public.vendors (id)
);

create table public.vendor_payments (
  id uuid not null default gen_random_uuid(),
  vendor_id uuid not null,
  payment_date date not null,
  amount numeric not null,
  mode text not null,
  sender_account_id uuid null,
  receiver_account_info text null,
  created_at timestamp with time zone null default now(),
  constraint vendor_payments_pkey primary key (id),
  constraint vendor_payments_sender_account_id_fkey foreign key (sender_account_id) references public.accounts (id),
  constraint vendor_payments_vendor_id_fkey foreign key (vendor_id) references public.vendors (id),
  constraint vendor_payments_mode_check check (mode = any (array['CASH'::text, 'UPI'::text, 'BANK'::text, 'CHEQUE'::text]))
);

create table public.vendor_procurement_settlements (
  id uuid not null default gen_random_uuid(),
  procurement_id uuid null,
  vendor_payment_id uuid null,
  applied_amount numeric not null,
  created_at timestamp with time zone null default now(),
  constraint vendor_procurement_settlements_pkey primary key (id),
  constraint vendor_procurement_settlements_procurement_id_fkey foreign key (procurement_id) references public.procurements (id),
  constraint vendor_procurement_settlements_vendor_payment_id_fkey foreign key (vendor_payment_id) references public.vendor_payments (id)
);

create table public.production_entries (
  id uuid not null default gen_random_uuid(),
  production_date date not null,
  bricks integer not null,
  round integer not null,
  wet_ash_kg numeric null,
  marble_powder_kg numeric null,
  crusher_powder_kg numeric null,
  fly_ash_kg numeric null,
  cement_bags numeric null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  notes text null,
  constraint production_entries_pkey primary key (id),
  constraint production_entries_created_by_fkey foreign key (created_by) references public.profiles (id)
);

create table public.inventory_adjustments (
  id uuid not null default gen_random_uuid(),
  adjustment_date date not null,
  actual_bricks integer null,
  actual_wet_ash_kg numeric null,
  actual_marble_powder_kg numeric null,
  actual_crusher_powder_kg numeric null,
  actual_fly_ash_kg numeric null,
  actual_cement_bags numeric null,
  adjusted_bricks integer null,
  adjusted_wet_ash_kg numeric null,
  adjusted_marble_powder_kg numeric null,
  adjusted_crusher_powder_kg numeric null,
  adjusted_fly_ash_kg numeric null,
  adjusted_cement_bags numeric null,
  reason text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint inventory_adjustments_pkey primary key (id),
  constraint inventory_adjustments_created_by_fkey foreign key (created_by) references public.profiles (id)
);

create table public.cash_ledger_days (
  id uuid not null default gen_random_uuid(),
  ledger_date date not null,
  status public.cash_day_status null default 'OPEN'::public.cash_day_status,
  opening_balance numeric not null,
  closing_balance numeric null,
  created_at timestamp with time zone null default now(),
  constraint cash_ledger_days_pkey primary key (id),
  constraint cash_ledger_days_ledger_date_key unique (ledger_date)
);

create table public.cash_ledger_entries (
  id uuid not null default gen_random_uuid(),
  ledger_day_id uuid null,
  direction public.cash_direction not null,
  source_type public.cash_in_source null,
  payment_type public.cash_out_type null,
  account_id uuid null,
  amount numeric not null,
  reason text null,
  created_at timestamp with time zone null default now(),
  constraint cash_ledger_entries_pkey primary key (id),
  constraint cash_ledger_entries_account_id_fkey foreign key (account_id) references public.accounts (id),
  constraint cash_ledger_entries_ledger_day_id_fkey foreign key (ledger_day_id) references public.cash_ledger_days (id)
);

create table public.loans (
  id uuid not null default gen_random_uuid(),
  lender_name text not null,
  loan_type public.loan_type not null,
  principal_amount numeric not null,
  interest_rate numeric null,
  outstanding_balance numeric not null,
  disbursement_account_id uuid null,
  start_date date not null,
  status public.loan_status null default 'ACTIVE'::public.loan_status,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint loans_pkey primary key (id),
  constraint loans_disbursement_account_id_fkey foreign key (disbursement_account_id) references public.accounts (id)
);

create table public.loan_ledger (
  id uuid not null default gen_random_uuid(),
  loan_id uuid null,
  transaction_type public.loan_transaction_type not null,
  amount numeric not null,
  running_balance numeric not null,
  payment_mode public.payment_mode not null,
  sender_account_id uuid null,
  receiver_account_info text null,
  transaction_date date not null,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint loan_ledger_pkey primary key (id),
  constraint loan_ledger_loan_id_fkey foreign key (loan_id) references public.loans (id),
  constraint loan_ledger_sender_account_id_fkey foreign key (sender_account_id) references public.accounts (id)
);

create table public.order_loadmen (
  order_id uuid not null,
  employee_id uuid not null,
  constraint order_loadmen_pkey primary key (order_id, employee_id),
  constraint order_loadmen_employee_id_fkey foreign key (employee_id) references public.employees (id) on delete cascade,
  constraint order_loadmen_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade
);

create table public.product_inventory (
  id uuid not null default gen_random_uuid(),
  product_type text not null default 'BRICKS'::text,
  quantity integer not null default 0,
  updated_at timestamp with time zone null default now(),
  constraint product_inventory_pkey primary key (id)
);

create table public.withdrawals (
  id bigint generated by default as identity not null,
  date date null,
  amount numeric null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  account_id uuid not null,
  constraint withdrawals_pkey primary key (id),
  constraint withdrawals_account_id_fkey foreign key (account_id) references public.accounts (id)
);
comment on table public.withdrawals is 'Admin money withdraws history are maintained here';

create table public.account_transfers (
  id bigint generated by default as identity not null,
  sender_account_id uuid not null,
  receiver_account_id uuid not null,
  amount numeric not null,
  transfer_date date not null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  constraint account_transfers_pkey primary key (id),
  constraint fk_sender_account foreign key (sender_account_id) references public.accounts (id),
  constraint fk_receiver_account foreign key (receiver_account_id) references public.accounts (id),
  constraint account_transfers_amount_check check (amount > 0::numeric)
);

create table public.expenses (
  id uuid not null default gen_random_uuid(),
  expense_date date not null,
  type_id uuid null,
  subtype_id uuid null,
  amount numeric not null,
  payment_mode public.payment_mode not null,
  sender_account_id uuid null,
  comments text null,
  created_at timestamp with time zone null default now(),
  constraint expenses_pkey primary key (id),
  constraint expenses_sender_account_id_fkey foreign key (sender_account_id) references public.accounts (id),
  constraint expenses_subtype_id_fkey foreign key (subtype_id) references public.expense_subtypes (id),
  constraint expenses_type_id_fkey foreign key (type_id) references public.expense_types (id)
);
