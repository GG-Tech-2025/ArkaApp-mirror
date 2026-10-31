-- Atomic money writes: one database transaction per business action.
--
-- Until now these were several client round trips (deduct the balance, then insert the row,
-- then settle FIFO ...), so a failure part-way left money moved with no record, or a record
-- with no money moved, and the client's hand-written "restore" calls could fail too. Each
-- function below does the whole action in one transaction: any error rolls everything back,
-- and the account / party row is locked first so concurrent calls queue up instead of
-- racing.
--
-- All of them are SECURITY INVOKER on purpose, like decrement/increment_account_balance:
-- the caller's RLS (tenant_isolation + admin_all) still applies to every statement, and
-- organization_id / branch_id still come from the column defaults. Each one also checks
-- private.is_admin() up front so a non-admin gets a clear error instead of an empty result.
--
-- Not applied automatically by this file being here -- review, then run it with
-- `supabase db push` (or the usual migration flow).

-- ------------------------------------------------------------------
-- 1. Expenses
-- ------------------------------------------------------------------

-- Records an expense and deducts it from the right account. CASH always means the branch's
-- cash account (sender_account_id is stored as null, as the app did before); any other mode
-- uses the account passed in. Raises 'Insufficient balance' if the account cannot cover it.
create or replace function public.record_expense(
  p_expense_date date,
  p_type_id uuid,
  p_subtype_id uuid,
  p_amount numeric,
  p_payment_mode public.payment_mode,
  p_sender_account_id uuid default null,
  p_comments text default null
)
returns public.expenses
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_account uuid;
  v_row public.expenses;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can record expenses' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  if p_payment_mode = 'CASH' then
    select a.id into v_account
    from public.accounts a
    where a.is_cash
    for update;
    if v_account is null then
      raise exception 'This branch has no cash account set up. Please contact your administrator.'
        using errcode = 'P0002';
    end if;
  else
    v_account := p_sender_account_id;
    if v_account is null then
      raise exception 'Account not found for deduction' using errcode = '22023';
    end if;
  end if;

  perform public.decrement_account_balance(v_account, p_amount);

  insert into public.expenses (
    expense_date, type_id, subtype_id, amount, payment_mode, sender_account_id, comments
  )
  values (
    p_expense_date, p_type_id, p_subtype_id, p_amount, p_payment_mode,
    case when p_payment_mode = 'CASH' then null else p_sender_account_id end,
    p_comments
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- Deletes an expense and gives the money back to the account it came from. The expense row
-- is locked first, so deleting it twice cannot refund twice.
create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_expense record;
  v_account uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can delete expenses' using errcode = '42501';
  end if;

  select e.amount, e.payment_mode, e.sender_account_id
  into v_expense
  from public.expenses e
  where e.id = p_expense_id
  for update;
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;

  if v_expense.payment_mode = 'CASH' then
    select a.id into v_account
    from public.accounts a
    where a.is_cash
    for update;
    if v_account is null then
      raise exception 'This branch has no cash account set up. Please contact your administrator.'
        using errcode = 'P0002';
    end if;
  else
    v_account := v_expense.sender_account_id;
    if v_account is null then
      raise exception 'Expense has no sender account to restore balance to' using errcode = '22023';
    end if;
  end if;

  perform public.increment_account_balance(v_account, v_expense.amount);
  delete from public.expenses where id = p_expense_id;
end;
$function$;

-- ------------------------------------------------------------------
-- 2. Vendor payment
-- ------------------------------------------------------------------

-- Pays a vendor from an account and settles their approved procurements oldest-first.
-- The vendor row is locked so two payments to the same vendor cannot both settle the same
-- procurement balance.
create or replace function public.record_vendor_payment(
  p_vendor_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_mode text,
  p_sender_account_id uuid,
  p_receiver_account_info text default null
)
returns public.vendor_payments
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row public.vendor_payments;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can record vendor payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_sender_account_id is null then
    raise exception 'Sender account is required' using errcode = '22023';
  end if;

  perform 1 from public.vendors v where v.id = p_vendor_id for update;
  if not found then
    raise exception 'Vendor not found' using errcode = 'P0002';
  end if;

  perform public.decrement_account_balance(p_sender_account_id, p_amount);

  insert into public.vendor_payments (
    vendor_id, payment_date, amount, mode, sender_account_id, receiver_account_info
  )
  values (
    p_vendor_id, p_payment_date, p_amount, p_mode, p_sender_account_id, p_receiver_account_info
  )
  returning * into v_row;

  perform public.apply_vendor_payment_fifo(p_vendor_id, v_row.id, p_amount);

  return v_row;
end;
$function$;

-- ------------------------------------------------------------------
-- 3. Account transfer
-- ------------------------------------------------------------------

-- Moves money between two accounts of the active branch. Both accounts are locked in id
-- order, so two opposite transfers (A->B and B->A) cannot deadlock.
create or replace function public.transfer_between_accounts(
  p_sender_account_id uuid,
  p_receiver_account_id uuid,
  p_amount numeric,
  p_transfer_date date,
  p_notes text default null
)
returns public.account_transfers
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_locked integer;
  v_row public.account_transfers;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can transfer between accounts' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_sender_account_id is null or p_receiver_account_id is null
     or p_sender_account_id = p_receiver_account_id then
    raise exception 'Sender and receiver accounts must be different' using errcode = '22023';
  end if;

  select count(*) into v_locked
  from (
    select a.id
    from public.accounts a
    where a.id in (p_sender_account_id, p_receiver_account_id)
    order by a.id
    for update
  ) locked;
  if v_locked <> 2 then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  perform public.decrement_account_balance(p_sender_account_id, p_amount);
  perform public.increment_account_balance(p_receiver_account_id, p_amount);

  insert into public.account_transfers (
    sender_account_id, receiver_account_id, amount, transfer_date, notes
  )
  values (
    p_sender_account_id, p_receiver_account_id, p_amount, p_transfer_date, p_notes
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- ------------------------------------------------------------------
-- 4. Withdrawal
-- ------------------------------------------------------------------

-- Takes money out of an account (owner withdrawal) and records it.
create or replace function public.record_withdrawal(
  p_account_id uuid,
  p_date date,
  p_amount numeric,
  p_notes text default null
)
returns public.withdrawals
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row public.withdrawals;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can record withdrawals' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  perform public.decrement_account_balance(p_account_id, p_amount);

  insert into public.withdrawals (date, amount, notes, account_id)
  values (p_date, p_amount, p_notes, p_account_id)
  returning * into v_row;

  return v_row;
end;
$function$;

-- ------------------------------------------------------------------
-- 5. Customer payment
-- ------------------------------------------------------------------

-- Records a customer payment, settles their delivered orders oldest-first and credits the
-- receiving account. The customer row is locked so two payments for the same customer
-- cannot settle the same order balance twice.
create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_mode public.payment_mode,
  p_receiver_account_id uuid,
  p_sender_account_no text default null
)
returns public.customer_payments
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row public.customer_payments;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can record customer payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_receiver_account_id is null then
    raise exception 'Receiver account is required' using errcode = '22023';
  end if;

  perform 1 from public.customers c where c.id = p_customer_id for update;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  insert into public.customer_payments (
    customer_id, payment_date, amount, mode, sender_account_no, receiver_account_id
  )
  values (
    p_customer_id, p_payment_date, p_amount, p_mode, p_sender_account_no, p_receiver_account_id
  )
  returning * into v_row;

  perform public.apply_customer_payment_fifo(p_customer_id, v_row.id, p_amount);
  perform public.increment_account_balance(p_receiver_account_id, p_amount);

  return v_row;
end;
$function$;

-- ------------------------------------------------------------------
-- Grants: signed-in users only (the admin check above does the rest)
-- ------------------------------------------------------------------
revoke execute on function public.record_expense(date, uuid, uuid, numeric, public.payment_mode, uuid, text) from public, anon;
revoke execute on function public.delete_expense(uuid) from public, anon;
revoke execute on function public.record_vendor_payment(uuid, date, numeric, text, uuid, text) from public, anon;
revoke execute on function public.transfer_between_accounts(uuid, uuid, numeric, date, text) from public, anon;
revoke execute on function public.record_withdrawal(uuid, date, numeric, text) from public, anon;
revoke execute on function public.record_customer_payment(uuid, date, numeric, public.payment_mode, uuid, text) from public, anon;

grant execute on function public.record_expense(date, uuid, uuid, numeric, public.payment_mode, uuid, text) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function public.record_vendor_payment(uuid, date, numeric, text, uuid, text) to authenticated;
grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, date, text) to authenticated;
grant execute on function public.record_withdrawal(uuid, date, numeric, text) to authenticated;
grant execute on function public.record_customer_payment(uuid, date, numeric, public.payment_mode, uuid, text) to authenticated;
