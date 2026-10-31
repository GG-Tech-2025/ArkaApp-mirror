-- Atomic writes, part 2: loans, procurement approval, production / inventory, orders,
-- vendors, salary payments and customer write-offs; plus row locks and a fixed
-- search_path on the FIFO / reverse / salary-batch functions.
--
-- Same rules as 20261026175659_atomic_money_rpcs.sql: one transaction per business action
-- (any error rolls the whole action back), the row that is about to be read-then-changed is
-- locked first, and every function is SECURITY INVOKER so tenant_isolation / admin_all RLS
-- still applies to each statement. Stock and balance changes are written as
-- `quantity = quantity +/- x` inside the database instead of read-in-the-browser-then-write,
-- so two people working at once cannot overwrite each other.
--
-- Production entries are submitted by employees, so record_production_entry accepts an
-- active employee as well as an admin; everything else here is admin-only.

-- ------------------------------------------------------------------
-- 1. Loans
-- ------------------------------------------------------------------

-- Creates a loan, its DISBURSEMENT ledger line and (when an account is chosen) credits that
-- account, all together. The ledger payment mode is CASH when the account is the branch's
-- cash account and BANK otherwise (and BANK when no account is chosen), as before.
create or replace function public.create_loan(
  p_lender_name text,
  p_loan_type public.loan_type,
  p_principal_amount numeric,
  p_start_date date,
  p_interest_rate numeric default null,
  p_disbursement_account_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_mode public.payment_mode := 'BANK';
  v_is_cash boolean;
  v_loan_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can create loans' using errcode = '42501';
  end if;
  if p_principal_amount is null or p_principal_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  if p_disbursement_account_id is not null then
    select a.is_cash into v_is_cash
    from public.accounts a
    where a.id = p_disbursement_account_id
    for update;
    if not found then
      raise exception 'Account not found' using errcode = 'P0002';
    end if;
    if v_is_cash then
      v_mode := 'CASH';
    end if;
  end if;

  insert into public.loans (
    lender_name, loan_type, principal_amount, interest_rate, outstanding_balance,
    disbursement_account_id, start_date, status, notes
  )
  values (
    p_lender_name, p_loan_type, p_principal_amount, p_interest_rate, p_principal_amount,
    p_disbursement_account_id, p_start_date, 'ACTIVE', p_notes
  )
  returning id into v_loan_id;

  insert into public.loan_ledger (
    loan_id, transaction_type, amount, running_balance, payment_mode,
    sender_account_id, receiver_account_info, transaction_date, notes
  )
  values (
    v_loan_id, 'DISBURSEMENT', p_principal_amount, p_principal_amount, v_mode,
    p_disbursement_account_id, p_lender_name, p_start_date, coalesce(p_notes, 'Loan disbursement')
  );

  if p_disbursement_account_id is not null then
    perform public.increment_account_balance(p_disbursement_account_id, p_principal_amount);
  end if;

  return v_loan_id;
end;
$function$;

-- Adds a ledger line to a loan. The loan row is locked, so the new running balance is
-- computed from the real current balance even when two people post at once. REPAYMENT and
-- INTEREST also take the money out of the sender account (as before); a REPAYMENT that is
-- larger than the outstanding balance, or any entry on a CLOSED loan, is refused.
-- Returns {"newBalance": n, "loanStatus": "ACTIVE" | "CLOSED"}.
create or replace function public.record_loan_transaction(
  p_loan_id uuid,
  p_transaction_type public.loan_transaction_type,
  p_amount numeric,
  p_transaction_date date,
  p_payment_mode public.payment_mode,
  p_sender_account_id uuid default null,
  p_receiver_account_info text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_loan record;
  v_new_balance numeric;
  v_status public.loan_status;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can record loan transactions' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  select l.outstanding_balance, l.status
  into v_loan
  from public.loans l
  where l.id = p_loan_id
  for update;
  if not found then
    raise exception 'Loan not found' using errcode = 'P0002';
  end if;
  if v_loan.status = 'CLOSED' then
    raise exception 'Loan is already closed' using errcode = '22023';
  end if;

  v_new_balance := v_loan.outstanding_balance;
  if p_transaction_type = 'DISBURSEMENT' then
    v_new_balance := v_new_balance + p_amount;
  elsif p_transaction_type = 'REPAYMENT' then
    v_new_balance := v_new_balance - p_amount;
  end if;
  -- INTEREST does not change the principal balance.

  if v_new_balance < 0 then
    raise exception 'Repayment amount exceeds outstanding balance' using errcode = '22023';
  end if;

  insert into public.loan_ledger (
    loan_id, transaction_type, amount, running_balance, payment_mode,
    sender_account_id, receiver_account_info, transaction_date, notes
  )
  values (
    p_loan_id, p_transaction_type, p_amount, v_new_balance, p_payment_mode,
    p_sender_account_id, p_receiver_account_info, p_transaction_date, p_notes
  );

  v_status := case when v_new_balance = 0 then 'CLOSED'::public.loan_status
                   else 'ACTIVE'::public.loan_status end;
  update public.loans
  set outstanding_balance = v_new_balance, status = v_status
  where id = p_loan_id;

  if p_transaction_type in ('REPAYMENT', 'INTEREST') and p_sender_account_id is not null then
    perform public.decrement_account_balance(p_sender_account_id, p_amount);
  end if;

  return jsonb_build_object('newBalance', v_new_balance, 'loanStatus', v_status);
end;
$function$;

-- ------------------------------------------------------------------
-- 2. Procurement approval
-- ------------------------------------------------------------------

-- Approves a procurement and adds its quantity (converted to kg: cement bags x 50, crusher
-- powder units x 4500, everything else tons x 1000) to the material's stock. The procurement
-- row is locked and an already-approved one is refused, so a double click cannot add the
-- stock twice.
create or replace function public.approve_procurement(
  p_procurement_id uuid,
  p_rate_per_unit numeric,
  p_total_price numeric
)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_proc record;
  v_name text;
  v_kg numeric;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can approve procurements' using errcode = '42501';
  end if;
  if p_rate_per_unit is null or p_rate_per_unit < 0 or p_total_price is null or p_total_price < 0 then
    raise exception 'Rate and total price cannot be negative' using errcode = '22023';
  end if;

  select p.material_id, p.quantity, p.approved
  into v_proc
  from public.procurements p
  where p.id = p_procurement_id
  for update;
  if not found then
    raise exception 'Procurement not found' using errcode = 'P0002';
  end if;
  if v_proc.approved is true then
    raise exception 'This procurement is already approved' using errcode = '22023';
  end if;

  select lower(m.name) into v_name from public.materials m where m.id = v_proc.material_id;
  v_kg := v_proc.quantity * case
    when v_name like '%cement%' then 50
    when v_name like '%crusher%' then 4500
    else 1000
  end;

  update public.procurements
  set approved = true, rate_per_unit = p_rate_per_unit, total_price = p_total_price
  where id = p_procurement_id;

  insert into public.inventory_stock (material_id, quantity, updated_at)
  values (v_proc.material_id, v_kg, now())
  on conflict (material_id) do update
    set quantity = public.inventory_stock.quantity + excluded.quantity,
        updated_at = now();
end;
$function$;

-- ------------------------------------------------------------------
-- 3. Production entry and inventory adjustment
-- ------------------------------------------------------------------

-- Records a production entry, adds the bricks to product stock and takes the raw materials
-- used out of material stock (kg per round for ash / powders, cement bags x 50 kg for the
-- whole entry). Stock may go negative on purpose: it evens out when the unapproved
-- procurements are approved later. Callable by an admin or an active employee.
create or replace function public.record_production_entry(
  p_production_date date,
  p_round integer,
  p_bricks integer,
  p_wet_ash_kg numeric,
  p_marble_powder_kg numeric,
  p_crusher_powder_kg numeric,
  p_fly_ash_kg numeric,
  p_cement_bags numeric,
  p_notes text default null
)
returns public.production_entries
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row public.production_entries;
  v_item record;
  v_material uuid;
begin
  if not ((select private.is_admin()) or (select private.is_active_employee())) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_round is null or p_round < 1 then
    raise exception 'Round must be at least 1' using errcode = '22023';
  end if;
  if p_bricks is null or p_bricks < 0
     or coalesce(p_wet_ash_kg, 0) < 0 or coalesce(p_marble_powder_kg, 0) < 0
     or coalesce(p_crusher_powder_kg, 0) < 0 or coalesce(p_fly_ash_kg, 0) < 0
     or coalesce(p_cement_bags, 0) < 0 then
    raise exception 'Quantities cannot be negative' using errcode = '22023';
  end if;

  insert into public.production_entries (
    production_date, round, bricks, wet_ash_kg, marble_powder_kg, crusher_powder_kg,
    fly_ash_kg, cement_bags, notes, created_by
  )
  values (
    p_production_date, p_round, p_bricks, p_wet_ash_kg, p_marble_powder_kg, p_crusher_powder_kg,
    p_fly_ash_kg, p_cement_bags, p_notes, (select auth.uid())
  )
  returning * into v_row;

  insert into public.product_inventory (product_type, quantity, updated_at)
  values ('BRICKS', p_bricks, now())
  on conflict (branch_id, product_type) do update
    set quantity = public.product_inventory.quantity + excluded.quantity,
        updated_at = now();

  for v_item in
    select t.pattern, t.qty
    from (values
      ('wet ash',  coalesce(p_wet_ash_kg, 0) * p_round),
      ('marble',   coalesce(p_marble_powder_kg, 0) * p_round),
      ('crusher',  coalesce(p_crusher_powder_kg, 0) * p_round),
      ('fly ash',  coalesce(p_fly_ash_kg, 0) * p_round),
      ('cement',   coalesce(p_cement_bags, 0) * 50)
    ) as t(pattern, qty)
  loop
    continue when v_item.qty <= 0;

    select m.id into v_material
    from public.materials m
    where lower(m.name) like '%' || v_item.pattern || '%'
    order by m.name
    limit 1;
    continue when v_material is null;

    insert into public.inventory_stock (material_id, quantity, updated_at)
    values (v_material, -v_item.qty, now())
    on conflict (material_id) do update
      set quantity = public.inventory_stock.quantity - v_item.qty,
          updated_at = now();
  end loop;

  return v_row;
end;
$function$;

-- Records a stock-take: saves the actual and adjusted figures and sets product / material
-- stock to the adjusted values (cement is entered in bags and stored in kg).
create or replace function public.create_inventory_adjustment(
  p_adjustment_date date,
  p_actual_bricks integer,
  p_actual_wet_ash_kg numeric,
  p_actual_marble_powder_kg numeric,
  p_actual_crusher_powder_kg numeric,
  p_actual_fly_ash_kg numeric,
  p_actual_cement_bags numeric,
  p_adjusted_bricks integer,
  p_adjusted_wet_ash_kg numeric,
  p_adjusted_marble_powder_kg numeric,
  p_adjusted_crusher_powder_kg numeric,
  p_adjusted_fly_ash_kg numeric,
  p_adjusted_cement_bags numeric,
  p_reason text default null
)
returns public.inventory_adjustments
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row public.inventory_adjustments;
  v_item record;
  v_material uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can adjust inventory' using errcode = '42501';
  end if;

  insert into public.inventory_adjustments (
    adjustment_date,
    actual_bricks, actual_wet_ash_kg, actual_marble_powder_kg, actual_crusher_powder_kg,
    actual_fly_ash_kg, actual_cement_bags,
    adjusted_bricks, adjusted_wet_ash_kg, adjusted_marble_powder_kg, adjusted_crusher_powder_kg,
    adjusted_fly_ash_kg, adjusted_cement_bags,
    reason, created_by
  )
  values (
    p_adjustment_date,
    p_actual_bricks, p_actual_wet_ash_kg, p_actual_marble_powder_kg, p_actual_crusher_powder_kg,
    p_actual_fly_ash_kg, p_actual_cement_bags,
    p_adjusted_bricks, p_adjusted_wet_ash_kg, p_adjusted_marble_powder_kg, p_adjusted_crusher_powder_kg,
    p_adjusted_fly_ash_kg, p_adjusted_cement_bags,
    p_reason, (select auth.uid())
  )
  returning * into v_row;

  if p_adjusted_bricks is not null then
    insert into public.product_inventory (product_type, quantity, updated_at)
    values ('BRICKS', p_adjusted_bricks, now())
    on conflict (branch_id, product_type) do update
      set quantity = excluded.quantity, updated_at = now();
  end if;

  for v_item in
    select t.pattern, t.qty
    from (values
      ('wet ash',  p_adjusted_wet_ash_kg),
      ('marble',   p_adjusted_marble_powder_kg),
      ('crusher',  p_adjusted_crusher_powder_kg),
      ('fly ash',  p_adjusted_fly_ash_kg),
      ('cement',   p_adjusted_cement_bags * 50)
    ) as t(pattern, qty)
  loop
    continue when v_item.qty is null;

    select m.id into v_material
    from public.materials m
    where lower(m.name) like '%' || v_item.pattern || '%'
    order by m.name
    limit 1;
    continue when v_material is null;

    insert into public.inventory_stock (material_id, quantity, updated_at)
    values (v_material, v_item.qty, now())
    on conflict (material_id) do update
      set quantity = excluded.quantity, updated_at = now();
  end loop;

  return v_row;
end;
$function$;

-- ------------------------------------------------------------------
-- 4. Orders
-- ------------------------------------------------------------------

-- Creates an order and its loadmen together. p_order carries the order columns (customer_id,
-- order_date, delivery_date, brick_quantity, price_per_brick, paper_price, final_price,
-- location, payment_status, amount_paid, gst_number, dc_number); anything else is ignored.
-- created_by is the signed-in user. Returns the new order's id.
create or replace function public.create_order(
  p_order jsonb,
  p_loadmen uuid[] default '{}'
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_in public.orders;
  v_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can create orders' using errcode = '42501';
  end if;

  v_in := jsonb_populate_record(null::public.orders, p_order);

  insert into public.orders (
    customer_id, order_date, delivery_date, brick_quantity, price_per_brick, paper_price,
    final_price, location, payment_status, amount_paid, gst_number, dc_number,
    delivered, created_by
  )
  values (
    v_in.customer_id, v_in.order_date, v_in.delivery_date, v_in.brick_quantity,
    v_in.price_per_brick, v_in.paper_price, v_in.final_price, v_in.location,
    coalesce(v_in.payment_status, 'NOT_PAID'), coalesce(v_in.amount_paid, 0),
    v_in.gst_number, v_in.dc_number,
    false, (select auth.uid())
  )
  returning id into v_id;

  insert into public.order_loadmen (order_id, employee_id)
  select v_id, e
  from unnest(coalesce(p_loadmen, '{}')) as e
  on conflict do nothing;

  return v_id;
end;
$function$;

-- Updates the given columns of an order and (unless p_skip_loadmen) replaces its loadmen
-- with p_loadmen, in one transaction with the order row locked. Only the columns named in
-- p_update are touched; a column set to null in p_update is set to null. If the update marks
-- a not-yet-delivered order as delivered, its bricks come off product stock.
create or replace function public.update_order_with_loadmen(
  p_order_id uuid,
  p_update jsonb,
  p_loadmen uuid[] default '{}',
  p_skip_loadmen boolean default false
)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_allowed constant text[] := array[
    'brick_quantity', 'delivery_date', 'price_per_brick', 'paper_price', 'final_price',
    'location', 'payment_status', 'amount_paid', 'gst_number', 'dc_number',
    'loading_type', 'time', 'delivered'
  ];
  v_key text;
  v_old record;
  v_new public.orders;
  v_qty integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can update orders' using errcode = '42501';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_update, '{}'::jsonb)) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'Order column "%" cannot be updated here', v_key using errcode = '22023';
    end if;
  end loop;

  select o.delivered, o.brick_quantity into v_old
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  v_new := jsonb_populate_record(null::public.orders, coalesce(p_update, '{}'::jsonb));

  update public.orders o
  set brick_quantity  = case when p_update ? 'brick_quantity'  then v_new.brick_quantity  else o.brick_quantity  end,
      delivery_date   = case when p_update ? 'delivery_date'   then v_new.delivery_date   else o.delivery_date   end,
      price_per_brick = case when p_update ? 'price_per_brick' then v_new.price_per_brick else o.price_per_brick end,
      paper_price     = case when p_update ? 'paper_price'     then v_new.paper_price     else o.paper_price     end,
      final_price     = case when p_update ? 'final_price'     then v_new.final_price     else o.final_price     end,
      location        = case when p_update ? 'location'        then v_new.location        else o.location        end,
      payment_status  = case when p_update ? 'payment_status'  then v_new.payment_status  else o.payment_status  end,
      amount_paid     = case when p_update ? 'amount_paid'     then v_new.amount_paid     else o.amount_paid     end,
      gst_number      = case when p_update ? 'gst_number'      then v_new.gst_number      else o.gst_number      end,
      dc_number       = case when p_update ? 'dc_number'       then v_new.dc_number       else o.dc_number       end,
      loading_type    = case when p_update ? 'loading_type'    then v_new.loading_type    else o.loading_type    end,
      time            = case when p_update ? 'time'            then v_new.time            else o.time            end,
      delivered       = case when p_update ? 'delivered'       then v_new.delivered       else o.delivered       end
  where o.id = p_order_id;

  -- Bricks leave stock once, when the order flips to delivered: the quantity in this update
  -- if it carries one, otherwise the order's own.
  v_qty := case when p_update ? 'brick_quantity' then v_new.brick_quantity else v_old.brick_quantity end;
  if v_new.delivered is true and v_old.delivered is not true and coalesce(v_qty, 0) <> 0 then
    update public.product_inventory
    set quantity = quantity - v_qty, updated_at = now()
    where product_type = 'BRICKS';
    if not found then
      raise exception 'No bricks inventory record found' using errcode = 'P0002';
    end if;
  end if;

  if not coalesce(p_skip_loadmen, false) then
    delete from public.order_loadmen
    where order_id = p_order_id
      and employee_id <> all (coalesce(p_loadmen, '{}'));

    insert into public.order_loadmen (order_id, employee_id)
    select p_order_id, e
    from unnest(coalesce(p_loadmen, '{}')) as e
    on conflict do nothing;
  end if;
end;
$function$;

-- ------------------------------------------------------------------
-- 5. Vendors
-- ------------------------------------------------------------------

create or replace function public.create_vendor_with_materials(
  p_name text,
  p_phone text default null,
  p_alternate_phone text default null,
  p_gst_number text default null,
  p_address text default null,
  p_notes text default null,
  p_material_ids uuid[] default '{}'
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can create vendors' using errcode = '42501';
  end if;

  insert into public.vendors (name, phone, alternate_phone, gst_number, address, notes)
  values (p_name, p_phone, p_alternate_phone, p_gst_number, p_address, p_notes)
  returning id into v_id;

  insert into public.vendor_materials (vendor_id, material_id)
  select v_id, m
  from unnest(coalesce(p_material_ids, '{}')) as m
  on conflict do nothing;

  return v_id;
end;
$function$;

create or replace function public.update_vendor_with_materials(
  p_vendor_id uuid,
  p_name text,
  p_phone text default null,
  p_alternate_phone text default null,
  p_gst_number text default null,
  p_address text default null,
  p_notes text default null,
  p_material_ids uuid[] default '{}'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can update vendors' using errcode = '42501';
  end if;

  perform 1 from public.vendors v where v.id = p_vendor_id for update;
  if not found then
    raise exception 'Vendor not found' using errcode = 'P0002';
  end if;

  update public.vendors
  set name = p_name, phone = p_phone, alternate_phone = p_alternate_phone,
      gst_number = p_gst_number, address = p_address, notes = p_notes
  where id = p_vendor_id;

  delete from public.vendor_materials
  where vendor_id = p_vendor_id
    and material_id <> all (coalesce(p_material_ids, '{}'));

  insert into public.vendor_materials (vendor_id, material_id)
  select p_vendor_id, m
  from unnest(coalesce(p_material_ids, '{}')) as m
  on conflict do nothing;
end;
$function$;

-- ------------------------------------------------------------------
-- 6. Salary payments and customer write-offs
-- ------------------------------------------------------------------

-- Adds a salary-ledger entry for an employee. AUTO / SALARY_AUTO_ENTRY / SALARY_MANUAL_ENTRY
-- add to what the employee is owed; every other type is a payment that subtracts from it
-- and (CASH -> the branch's cash account, otherwise the sender account) takes the money out
-- of the account. The employee row is locked first -- the same lock record_loader_wage and
-- generate_salary_batch take -- so the running balance is always built on the latest entry.
create or replace function public.record_salary_ledger_entry(
  p_employee_id uuid,
  p_entry_type public.salary_entry_type,
  p_amount numeric,
  p_payment_at timestamptz default null,
  p_payment_mode public.payment_mode default null,
  p_sender_account_id uuid default null,
  p_receiver_account text default null,
  p_notes text default null
)
returns public.salary_ledger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_is_payment boolean;
  v_account uuid;
  v_balance numeric;
  v_row public.salary_ledger;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can record salary entries' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  v_is_payment := p_entry_type not in ('AUTO', 'SALARY_AUTO_ENTRY', 'SALARY_MANUAL_ENTRY');

  perform 1 from public.employees e where e.id = p_employee_id for update;
  if not found then
    raise exception 'Employee not found' using errcode = 'P0002';
  end if;

  if v_is_payment then
    if p_payment_mode = 'CASH' then
      select a.id into v_account from public.accounts a where a.is_cash for update;
      if v_account is null then
        raise exception 'This branch has no cash account set up. Please contact your administrator.'
          using errcode = 'P0002';
      end if;
    else
      v_account := p_sender_account_id;
    end if;

    if v_account is not null then
      perform public.decrement_account_balance(v_account, p_amount);
    end if;
  end if;

  select sl.running_balance into v_balance
  from public.salary_ledger sl
  where sl.employee_id = p_employee_id
  order by sl.created_at desc
  limit 1;

  insert into public.salary_ledger (
    employee_id, entry_type, amount, running_balance, payment_mode, sender_account_id,
    receiver_account, notes, payment_at, created_at
  )
  values (
    p_employee_id, p_entry_type, p_amount,
    coalesce(v_balance, 0) + case when v_is_payment then -p_amount else p_amount end,
    p_payment_mode, p_sender_account_id, p_receiver_account, p_notes,
    coalesce(p_payment_at, now()), clock_timestamp()
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- Records a customer write-off and applies it to the customer's delivered orders oldest-first.
-- The customer row is locked, like record_customer_payment, so payments and write-offs for
-- the same customer queue up.
create or replace function public.create_customer_writeoff(
  p_customer_id uuid,
  p_amount numeric,
  p_reason text
)
returns public.customer_writeoffs
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row public.customer_writeoffs;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can write off customer balances' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  perform 1 from public.customers c where c.id = p_customer_id for update;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  insert into public.customer_writeoffs (customer_id, amount, reason)
  values (p_customer_id, p_amount, p_reason)
  returning * into v_row;

  perform public.apply_customer_writeoff_fifo(p_customer_id, v_row.id, p_amount);

  return v_row;
end;
$function$;

-- ------------------------------------------------------------------
-- 7. Locks and a fixed search_path on the existing FIFO / reverse / salary functions
--    (bodies are unchanged except for the lines marked LOCK / SEARCH_PATH)
-- ------------------------------------------------------------------

create or replace function public.apply_customer_payment_fifo(p_customer_id uuid, p_payment_id uuid, p_amount numeric)
returns void
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  remaining_amount numeric := p_amount;
  o record;
begin
  for o in
    select
      id,
      final_price,
      coalesce(amount_paid, 0) as paid,
      coalesce(written_off_amount, 0) as written_off
    from orders
    where customer_id = p_customer_id
      and delivered = true
      and final_price > coalesce(amount_paid, 0) + coalesce(written_off_amount, 0)
    order by order_date asc
    for update   -- LOCK
  loop
    exit when remaining_amount <= 0;

    if remaining_amount >= (o.final_price - o.paid - o.written_off) then
      update orders
      set amount_paid = final_price - written_off_amount
      where id = o.id;

      remaining_amount := remaining_amount - (o.final_price - o.paid - o.written_off);
    else
      update orders
      set amount_paid = o.paid + remaining_amount
      where id = o.id;

      remaining_amount := 0;
    end if;
  end loop;

  update orders
  set payment_status =
    case
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) = 0
        then 'NOT_PAID'::payment_status
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) < final_price
        then 'PARTIALLY_PAID'::payment_status
      else
        'FULLY_PAID'::payment_status
    end
  where customer_id = p_customer_id
  and delivered = true;
end;
$function$;

create or replace function public.apply_customer_writeoff_fifo(p_customer_id uuid, p_writeoff_id uuid, p_amount numeric)
returns void
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  remaining_amount numeric := p_amount;
  o record;
begin
  for o in
    select
      id,
      final_price,
      coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) as settled
    from orders
    where customer_id = p_customer_id
      and delivered = true
      and final_price > coalesce(amount_paid, 0) + coalesce(written_off_amount, 0)
    order by order_date asc
    for update   -- LOCK
  loop
    exit when remaining_amount <= 0;

    if remaining_amount >= (o.final_price - o.settled) then
      update orders
      set written_off_amount = coalesce(written_off_amount, 0) + (o.final_price - o.settled)
      where id = o.id;

      remaining_amount := remaining_amount - (o.final_price - o.settled);
    else
      update orders
      set written_off_amount = coalesce(written_off_amount, 0) + remaining_amount
      where id = o.id;

      remaining_amount := 0;
    end if;
  end loop;

  update orders
  set payment_status =
    case
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) = 0
        then 'NOT_PAID'::payment_status
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) < final_price
        then 'PARTIALLY_PAID'::payment_status
      else
        'FULLY_PAID'::payment_status
    end
  where customer_id = p_customer_id
    and delivered = true;
end;
$function$;

create or replace function public.apply_vendor_payment_fifo(p_vendor_id uuid, p_payment_id uuid, p_amount numeric)
returns void
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  v_remaining numeric := p_amount;
  v_proc record;
  v_balance numeric;
  v_apply numeric;
begin
  for v_proc in
    select *
    from procurements
    where vendor_id = p_vendor_id
      and payment_status in ('NOT_PAID', 'PARTIALLY_PAID')
      and approved = true
    order by date asc
    for update   -- LOCK
  loop
    exit when v_remaining <= 0;

    v_balance := v_proc.total_price - coalesce(v_proc.total_paid, 0);

    if v_balance <= 0 then
      continue;
    end if;

    v_apply := least(v_balance, v_remaining);

    insert into vendor_procurement_settlements(
      procurement_id,
      vendor_payment_id,
      applied_amount
    )
    values (
      v_proc.id,
      p_payment_id,
      v_apply
    );

    update procurements
    set total_paid = coalesce(total_paid, 0) + v_apply,
        payment_status =
          case
            when (coalesce(total_paid, 0) + v_apply) >= total_price
              then 'PAID'
            else 'PARTIALLY_PAID'
          end
    where id = v_proc.id;

    v_remaining := v_remaining - v_apply;
  end loop;
end;
$function$;

-- Reversals lock the customer / vendor first (the same order the record_* functions use),
-- then re-read the payment FOR UPDATE, so two reversals of the same payment cannot both
-- adjust the balance: the second one finds the payment gone and stops.
create or replace function public.reverse_customer_payment(p_payment_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  v_customer_id uuid;
  v_amount numeric;
  v_receiver_account_id uuid;
  v_remaining numeric;
  o record;
  p record;
begin
  select customer_id into v_customer_id
  from customer_payments
  where id = p_payment_id;

  if not found then
    raise exception 'Payment not found: %', p_payment_id;
  end if;

  perform 1 from customers where id = v_customer_id for update;   -- LOCK

  select customer_id, amount, receiver_account_id
  into v_customer_id, v_amount, v_receiver_account_id
  from customer_payments
  where id = p_payment_id
  for update;   -- LOCK

  if not found then
    raise exception 'Payment not found: %', p_payment_id;
  end if;

  if v_receiver_account_id is not null then
    update accounts
    set balance = balance - v_amount
    where id = v_receiver_account_id;
  end if;

  delete from customer_payments
  where id = p_payment_id;

  update orders
  set amount_paid = 0,
      payment_status = 'NOT_PAID'::payment_status
  where customer_id = v_customer_id
    and delivered = true;

  for p in
    select id, amount
    from customer_payments
    where customer_id = v_customer_id
    order by payment_date asc, created_at asc
  loop
    v_remaining := p.amount;

    for o in
      select id, final_price, coalesce(amount_paid, 0) as paid, coalesce(written_off_amount, 0) as written_off
      from orders
      where customer_id = v_customer_id
        and delivered = true
        and final_price > coalesce(amount_paid, 0) + coalesce(written_off_amount, 0)
      order by order_date asc
    loop
      exit when v_remaining <= 0;

      if v_remaining >= (o.final_price - o.paid - o.written_off) then
        update orders
        set amount_paid = final_price - written_off_amount
        where id = o.id;

        v_remaining := v_remaining - (o.final_price - o.paid - o.written_off);
      else
        update orders
        set amount_paid = o.paid + v_remaining
        where id = o.id;

        v_remaining := 0;
      end if;
    end loop;
  end loop;

  update orders
  set payment_status =
    case
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) = 0
        then 'NOT_PAID'::payment_status
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) < final_price
        then 'PARTIALLY_PAID'::payment_status
      else
        'FULLY_PAID'::payment_status
    end
  where customer_id = v_customer_id
    and delivered = true;
end;
$function$;

create or replace function public.reverse_customer_writeoff(p_writeoff_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  v_customer_id uuid;
  v_remaining numeric;
  o record;
  w record;
begin
  select customer_id into v_customer_id
  from customer_writeoffs
  where id = p_writeoff_id;

  if not found then
    raise exception 'Write-off not found: %', p_writeoff_id;
  end if;

  perform 1 from customers where id = v_customer_id for update;   -- LOCK

  select customer_id into v_customer_id
  from customer_writeoffs
  where id = p_writeoff_id
  for update;   -- LOCK

  if not found then
    raise exception 'Write-off not found: %', p_writeoff_id;
  end if;

  delete from customer_writeoffs
  where id = p_writeoff_id;

  update orders
  set written_off_amount = 0
  where customer_id = v_customer_id
    and delivered = true;

  for w in
    select id, amount
    from customer_writeoffs
    where customer_id = v_customer_id
    order by write_off_date asc, created_at asc
  loop
    v_remaining := w.amount;

    for o in
      select id, final_price, coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) as settled
      from orders
      where customer_id = v_customer_id
        and delivered = true
        and final_price > coalesce(amount_paid, 0) + coalesce(written_off_amount, 0)
      order by order_date asc
    loop
      exit when v_remaining <= 0;

      if v_remaining >= (o.final_price - o.settled) then
        update orders
        set written_off_amount = coalesce(written_off_amount, 0) + (o.final_price - o.settled)
        where id = o.id;

        v_remaining := v_remaining - (o.final_price - o.settled);
      else
        update orders
        set written_off_amount = coalesce(written_off_amount, 0) + v_remaining
        where id = o.id;

        v_remaining := 0;
      end if;
    end loop;
  end loop;

  update orders
  set payment_status =
    case
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) = 0
        then 'NOT_PAID'::payment_status
      when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) < final_price
        then 'PARTIALLY_PAID'::payment_status
      else
        'FULLY_PAID'::payment_status
    end
  where customer_id = v_customer_id
    and delivered = true;
end;
$function$;

create or replace function public.reverse_vendor_payment(p_payment_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  v_vendor_id uuid;
  v_amount numeric;
  v_sender_account_id uuid;
  v_settlement record;
  v_new_paid numeric;
  v_total_price numeric;
  v_new_status text;
begin
  select vendor_id into v_vendor_id
  from vendor_payments
  where id = p_payment_id;

  if not found then
    raise exception 'Vendor payment not found: %', p_payment_id;
  end if;

  perform 1 from vendors where id = v_vendor_id for update;   -- LOCK

  select vendor_id, amount, sender_account_id
  into v_vendor_id, v_amount, v_sender_account_id
  from vendor_payments
  where id = p_payment_id
  for update;   -- LOCK

  if not found then
    raise exception 'Vendor payment not found: %', p_payment_id;
  end if;

  for v_settlement in
    select procurement_id, applied_amount
    from vendor_procurement_settlements
    where vendor_payment_id = p_payment_id
  loop
    update procurements
    set total_paid = greatest(coalesce(total_paid, 0) - v_settlement.applied_amount, 0)
    where id = v_settlement.procurement_id;

    select coalesce(total_paid, 0), total_price
    into v_new_paid, v_total_price
    from procurements
    where id = v_settlement.procurement_id;

    if v_new_paid <= 0 then
      v_new_status := 'NOT_PAID';
    elsif v_new_paid >= v_total_price then
      v_new_status := 'PAID';
    else
      v_new_status := 'PARTIALLY_PAID';
    end if;

    update procurements
    set payment_status = v_new_status
    where id = v_settlement.procurement_id;
  end loop;

  delete from vendor_procurement_settlements
  where vendor_payment_id = p_payment_id;

  if v_sender_account_id is not null then
    update accounts
    set balance = balance + v_amount
    where id = v_sender_account_id;
  end if;

  delete from vendor_payments
  where id = p_payment_id;
end;
$function$;

-- The salary batch locks each employee row before reading their running balance (the same
-- lock record_loader_wage takes), so a loader wage posted while the batch runs cannot be
-- built on a stale balance. The unique (branch_id, month) on salary_batches still rejects a
-- second batch for the same month if two people press the button together.
create or replace function public.generate_salary_batch(p_month date, p_items json)
returns json
language plpgsql
set search_path = public, pg_temp   -- SEARCH_PATH
as $function$
declare
  v_batch_id uuid;
  v_item json;
  v_employee_id uuid;
  v_final_salary numeric;
  v_current_balance numeric;
  v_new_balance numeric;
begin
  if exists (
    select 1 from salary_batches where month = p_month
  ) then
    raise exception 'Salary already generated for this month';
  end if;

  insert into salary_batches (month, status)
  values (p_month, 'GENERATED')
  returning id into v_batch_id;

  for v_item in select * from json_array_elements(p_items)
  loop
    v_employee_id := (v_item->>'employee_id')::uuid;
    v_final_salary := (v_item->>'final_salary')::numeric;

    perform 1 from employees where id = v_employee_id for update;   -- LOCK

    insert into salary_batch_items (
      batch_id,
      employee_id,
      present_days,
      absent_days,
      leave_days,
      half_days,
      base_salary,
      final_salary
    )
    values (
      v_batch_id,
      v_employee_id,
      coalesce((v_item->>'present_days')::int, 0),
      coalesce((v_item->>'absent_days')::int, 0),
      coalesce((v_item->>'leave_days')::int, 0),
      coalesce((v_item->>'half_days')::int, 0),
      (v_item->>'base_salary')::numeric,
      v_final_salary
    );

    select running_balance
    into v_current_balance
    from salary_ledger
    where employee_id = v_employee_id
    order by created_at desc
    limit 1;

    v_current_balance := coalesce(v_current_balance, 0);

    v_new_balance := v_current_balance + v_final_salary;

    insert into salary_ledger (
      employee_id,
      entry_type,
      amount,
      running_balance,
      payment_mode,
      sender_account_id,
      receiver_account,
      notes,
      salary_batch_id
    )
    values (
      v_employee_id,
      'SALARY_AUTO_ENTRY',
      v_final_salary,
      v_new_balance,
      null,
      null,
      null,
      'Salary generated for ' || p_month,
      v_batch_id
    );
  end loop;

  return json_build_object(
    'batch_id', v_batch_id,
    'message', 'Salary generated successfully'
  );
end;
$function$;

-- ------------------------------------------------------------------
-- Grants: signed-in users only. The existing money functions were executable by PUBLIC /
-- anon by default; anon has no rows to touch, but there is no reason for it to be able to
-- call them at all.
-- ------------------------------------------------------------------
revoke execute on function public.create_loan(text, public.loan_type, numeric, date, numeric, uuid, text) from public, anon;
revoke execute on function public.record_loan_transaction(uuid, public.loan_transaction_type, numeric, date, public.payment_mode, uuid, text, text) from public, anon;
revoke execute on function public.approve_procurement(uuid, numeric, numeric) from public, anon;
revoke execute on function public.record_production_entry(date, integer, integer, numeric, numeric, numeric, numeric, numeric, text) from public, anon;
revoke execute on function public.create_inventory_adjustment(date, integer, numeric, numeric, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, text) from public, anon;
revoke execute on function public.create_order(jsonb, uuid[]) from public, anon;
revoke execute on function public.update_order_with_loadmen(uuid, jsonb, uuid[], boolean) from public, anon;
revoke execute on function public.create_vendor_with_materials(text, text, text, text, text, text, uuid[]) from public, anon;
revoke execute on function public.update_vendor_with_materials(uuid, text, text, text, text, text, text, uuid[]) from public, anon;
revoke execute on function public.record_salary_ledger_entry(uuid, public.salary_entry_type, numeric, timestamptz, public.payment_mode, uuid, text, text) from public, anon;
revoke execute on function public.create_customer_writeoff(uuid, numeric, text) from public, anon;
revoke execute on function public.apply_customer_payment_fifo(uuid, uuid, numeric) from public, anon;
revoke execute on function public.apply_customer_writeoff_fifo(uuid, uuid, numeric) from public, anon;
revoke execute on function public.apply_vendor_payment_fifo(uuid, uuid, numeric) from public, anon;
revoke execute on function public.reverse_customer_payment(uuid) from public, anon;
revoke execute on function public.reverse_customer_writeoff(uuid) from public, anon;
revoke execute on function public.reverse_vendor_payment(uuid) from public, anon;
revoke execute on function public.generate_salary_batch(date, json) from public, anon;
revoke execute on function public.increment_account_balance(uuid, numeric) from public, anon;
revoke execute on function public.decrement_account_balance(uuid, numeric) from public, anon;

grant execute on function public.create_loan(text, public.loan_type, numeric, date, numeric, uuid, text) to authenticated;
grant execute on function public.record_loan_transaction(uuid, public.loan_transaction_type, numeric, date, public.payment_mode, uuid, text, text) to authenticated;
grant execute on function public.approve_procurement(uuid, numeric, numeric) to authenticated;
grant execute on function public.record_production_entry(date, integer, integer, numeric, numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.create_inventory_adjustment(date, integer, numeric, numeric, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.create_order(jsonb, uuid[]) to authenticated;
grant execute on function public.update_order_with_loadmen(uuid, jsonb, uuid[], boolean) to authenticated;
grant execute on function public.create_vendor_with_materials(text, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.update_vendor_with_materials(uuid, text, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.record_salary_ledger_entry(uuid, public.salary_entry_type, numeric, timestamptz, public.payment_mode, uuid, text, text) to authenticated;
grant execute on function public.create_customer_writeoff(uuid, numeric, text) to authenticated;
grant execute on function public.apply_customer_payment_fifo(uuid, uuid, numeric) to authenticated;
grant execute on function public.apply_customer_writeoff_fifo(uuid, uuid, numeric) to authenticated;
grant execute on function public.apply_vendor_payment_fifo(uuid, uuid, numeric) to authenticated;
grant execute on function public.reverse_customer_payment(uuid) to authenticated;
grant execute on function public.reverse_customer_writeoff(uuid) to authenticated;
grant execute on function public.reverse_vendor_payment(uuid) to authenticated;
grant execute on function public.generate_salary_batch(date, json) to authenticated;
grant execute on function public.increment_account_balance(uuid, numeric) to authenticated;
grant execute on function public.decrement_account_balance(uuid, numeric) to authenticated;
