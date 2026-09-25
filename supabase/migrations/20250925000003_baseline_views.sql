-- Baseline migration 4/4: views
-- Pulled verbatim from information_schema.views on the live "Arka demo" Supabase project as of 2026-09-25.

create or replace view public.customer_writeoffs_view as
select id,
    customer_id,
    amount,
    reason,
    write_off_date,
    created_at
   from customer_writeoffs w
  order by write_off_date desc, created_at desc;

create or replace view public.total_withdrawals_view as
select coalesce(sum(amount), (0)::numeric) as total_withdrawals
   from withdrawals;

create or replace view public.order_running_totals as
select id as order_id,
    customer_id,
    order_date,
    created_at,
    final_price,
    sum(final_price) over (partition by customer_id order by order_date, created_at rows between unbounded preceding and current row) as cumulative_order_total
   from orders o;

create or replace view public.payment_running_totals as
select customer_id,
    sum(amount) as total_paid
   from customer_payments p
  group by customer_id;

create or replace view public.customer_financials as
select c.id as customer_id,
    c.name,
    c.phone,
    c.address,
    coalesce(o.total_sales, (0)::numeric) as total_sales,
    coalesce(o.total_paid_from_orders, (0)::numeric) as total_paid,
    ((coalesce(o.total_sales, (0)::numeric) - coalesce(o.total_paid_from_orders, (0)::numeric)) - coalesce(o.total_written_off, (0)::numeric)) as outstanding_amount,
    coalesce(o.total_written_off, (0)::numeric) as total_written_off
   from (customers c
     left join ( select orders.customer_id,
            sum(orders.final_price) as total_sales,
            sum(coalesce(orders.amount_paid, (0)::numeric)) as total_paid_from_orders,
            sum(coalesce(orders.written_off_amount, (0)::numeric)) as total_written_off
           from orders
          where (orders.delivered = true)
          group by orders.customer_id) o on ((o.customer_id = c.id)));

create or replace view public.customer_order_settlement as
select id as order_id,
    customer_id,
    order_date,
    delivery_date,
    brick_quantity,
    final_price,
    gst_number,
    dc_number,
    coalesce(amount_paid, (0)::numeric) as total_paid,
    ((final_price - coalesce(amount_paid, (0)::numeric)) - coalesce(written_off_amount, (0)::numeric)) as remaining_balance,
        case
            when ((coalesce(amount_paid, (0)::numeric) + coalesce(written_off_amount, (0)::numeric)) = (0)::numeric) then 'NOT_PAID'::text
            when ((coalesce(amount_paid, (0)::numeric) + coalesce(written_off_amount, (0)::numeric)) >= final_price) then 'FULLY_PAID'::text
            else 'PARTIALLY_PAID'::text
        end as payment_status,
    delivered,
    coalesce(written_off_amount, (0)::numeric) as written_off_amount,
    location
   from orders o;

create or replace view public.vendor_procurement_settlement as
select id as procurement_id,
    vendor_id,
    date,
    total_price,
    total_paid,
    (total_price - coalesce(total_paid, (0)::numeric)) as remaining_balance,
    payment_status
   from procurements p;

create or replace view public.vendor_financials as
select v.id as vendor_id,
    v.name,
    coalesce(sum(p.total_price), (0)::numeric) as total_purchase,
    coalesce(sum(p.total_paid), (0)::numeric) as total_paid,
    (coalesce(sum(p.total_price), (0)::numeric) - coalesce(sum(p.total_paid), (0)::numeric)) as outstanding_balance
   from (vendors v
     left join procurements p on (((p.vendor_id = v.id) and (p.approved = true))))
  group by v.id, v.name;

create or replace view public.employee_with_balance as
select e.id,
    e.name,
    e.phone,
    r.name as role_name,
    r.category,
    coalesce(sl.running_balance, (0)::numeric) as running_balance,
    e.active
   from ((employees e
     left join roles r on ((r.id = e.role_id)))
     left join lateral ( select salary_ledger.running_balance
           from salary_ledger
          where (salary_ledger.employee_id = e.id)
          order by salary_ledger.created_at desc
         limit 1) sl on (true));

create or replace view public.customer_payments_view as
select p.id,
    p.customer_id,
    p.order_id,
    p.payment_date,
    p.amount,
    p.mode,
    p.sender_account_no,
    a.account_number as receiver_account,
    p.created_at
   from (customer_payments p
     left join accounts a on ((a.id = p.receiver_account_id)))
  order by p.payment_date desc;
