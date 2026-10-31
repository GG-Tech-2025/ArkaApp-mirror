-- Customer write-off feature (post-delivery negotiated discounts)
--
-- Lets admins write off part/all of a customer's outstanding balance (e.g. a
-- negotiated discount after delivery) without recording it as a real payment.
-- Fully parallel to the existing customer-payment pipeline: never touches
-- orders.amount_paid, customer_payments, or account balances, so cash-flow /
-- reconciliation figures stay accurate.
--
-- Verified end-to-end against Arka demo (icnxulbrbkhcfatepexb) before being
-- copied here — this is the exact, final state of every object, including a
-- fix for an interaction bug where a real payment could be misallocated onto
-- an order already covered by a write-off (see apply_customer_payment_fifo /
-- reverse_customer_payment below — both now factor in written_off_amount).
--
-- Safe to run more than once (idempotent): new objects use IF NOT EXISTS,
-- existing functions/views use CREATE OR REPLACE.

-- 1. Write-off tracking column on orders (isolated from amount_paid)
alter table public.orders
  add column if not exists written_off_amount numeric not null default 0;

-- 2. Write-off ledger table (customer-level, mirrors customer_payments)
create table if not exists public.customer_writeoffs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  amount numeric not null check (amount > 0),
  reason text not null,
  write_off_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 3. Read view for listing/export (mirrors customer_payments_view)
create or replace view public.customer_writeoffs_view as
select
  w.id,
  w.customer_id,
  w.amount,
  w.reason,
  w.write_off_date,
  w.created_at
from public.customer_writeoffs w
order by w.write_off_date desc, w.created_at desc;

-- 4. FIFO application of a write-off across the customer's oldest outstanding delivered orders
create or replace function public.apply_customer_writeoff_fifo(
  p_customer_id uuid,
  p_writeoff_id uuid,
  p_amount numeric
) returns void
language plpgsql
as $$
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
$$;

-- 5. Reverse a write-off: resets written_off_amount only (never touches amount_paid or accounts),
--    then replays remaining write-offs for the customer in FIFO order.
create or replace function public.reverse_customer_writeoff(
  p_writeoff_id uuid
) returns void
language plpgsql
as $$
declare
  v_customer_id uuid;
  v_remaining numeric;
  o record;
  w record;
begin
  select customer_id
  into v_customer_id
  from customer_writeoffs
  where id = p_writeoff_id;

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
$$;

-- 6. Teach the existing payment RPCs about written_off_amount so payment_status stays
--    correct when a write-off already covers part of an order, AND so the FIFO loop
--    itself skips orders already covered by a write-off instead of over-settling them.
--    Additive only: written_off_amount defaults to 0, so orders with no write-off
--    behave exactly as before.
create or replace function public.apply_customer_payment_fifo(
  p_customer_id uuid,
  p_payment_id uuid,
  p_amount numeric
) returns void
language plpgsql
as $$
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
$$;

create or replace function public.reverse_customer_payment(
  p_payment_id uuid
) returns void
language plpgsql
as $$
declare
  v_customer_id uuid;
  v_amount numeric;
  v_receiver_account_id uuid;
  v_remaining numeric;
  o record;
  p record;
begin
  select customer_id, amount, receiver_account_id
  into v_customer_id, v_amount, v_receiver_account_id
  from customer_payments
  where id = p_payment_id;

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
$$;

-- 7. Views: fold write-offs into remaining balance / outstanding, and expose orders.location
--    (pre-existing column, just not surfaced here before). total_sales is untouched
--    (a write-off closes the receivable, it does not rewrite billed revenue). Existing
--    columns keep their names/order/types; new columns are appended at the end.
create or replace view public.customer_order_settlement as
select
  id as order_id,
  customer_id,
  order_date,
  delivery_date,
  brick_quantity,
  final_price,
  gst_number,
  dc_number,
  coalesce(amount_paid, 0) as total_paid,
  (final_price - coalesce(amount_paid, 0) - coalesce(written_off_amount, 0)) as remaining_balance,
  case
    when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) = 0 then 'NOT_PAID'
    when coalesce(amount_paid, 0) + coalesce(written_off_amount, 0) >= final_price then 'FULLY_PAID'
    else 'PARTIALLY_PAID'
  end as payment_status,
  delivered,
  coalesce(written_off_amount, 0) as written_off_amount,
  location
from orders o;

create or replace view public.customer_financials as
select
  c.id as customer_id,
  c.name,
  c.phone,
  c.address,
  coalesce(o.total_sales, 0) as total_sales,
  coalesce(o.total_paid_from_orders, 0) as total_paid,
  (coalesce(o.total_sales, 0) - coalesce(o.total_paid_from_orders, 0) - coalesce(o.total_written_off, 0)) as outstanding_amount,
  coalesce(o.total_written_off, 0) as total_written_off
from customers c
left join (
  select
    customer_id,
    sum(final_price) as total_sales,
    sum(coalesce(amount_paid, 0)) as total_paid_from_orders,
    sum(coalesce(written_off_amount, 0)) as total_written_off
  from orders
  where delivered = true
  group by customer_id
) o on o.customer_id = c.id;
