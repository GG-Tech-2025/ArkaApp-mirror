-- Phase 6, PR 1 follow-up: delivery goes through one database function, and an employee only
-- sees undelivered orders.
--
-- Why: letting employees read delivered orders also fed the invoker views and RPCs built on orders
-- (customer_financials, get_financial_summary), so a signed-in employee could read what customers
-- owe. Hiding delivered orders breaks the direct UPDATE that marks an order delivered (Postgres
-- checks the new row against the SELECT policy), and a direct write was the wrong shape anyway:
-- the order update, the stock deduction and the loadmen were three separate client calls.
-- complete_delivery does all of it in one transaction, so employees need no write policy on
-- orders or order_loadmen at all.

create or replace function public.complete_delivery(
  p_order_id uuid,
  p_time text,
  p_brick_quantity integer,
  p_location text,
  p_payment_status public.payment_status,
  p_amount_paid numeric,
  p_gst_number text,
  p_dc_number text,
  p_loading_type text,
  p_loadmen uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (select private.current_org_id());
  v_branch uuid := (select private.active_branch_id());
  v_delivered boolean;
  v_loadman uuid;
begin
  if not ((select private.is_admin()) or (select private.is_active_employee())) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_org is null or v_branch is null then
    raise exception 'No active branch' using errcode = '42501';
  end if;
  if p_brick_quantity is null or p_brick_quantity <= 0 then
    raise exception 'Brick quantity must be greater than zero' using errcode = '22023';
  end if;
  if p_amount_paid is null or p_amount_paid < 0 then
    raise exception 'Amount paid cannot be negative' using errcode = '22023';
  end if;

  select o.delivered into v_delivered
  from public.orders o
  where o.id = p_order_id and o.organization_id = v_org and o.branch_id = v_branch
  for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_delivered is true then
    raise exception 'This order is already delivered' using errcode = '22023';
  end if;

  update public.orders
     set time = p_time,
         brick_quantity = p_brick_quantity,
         location = p_location,
         payment_status = p_payment_status,
         amount_paid = p_amount_paid,
         gst_number = p_gst_number,
         dc_number = p_dc_number,
         loading_type = p_loading_type,
         delivered = true
   where id = p_order_id;

  -- Same as the client did: bricks leave stock on delivery, and stock may go negative so it
  -- tallies when production is entered later.
  update public.product_inventory
     set quantity = quantity - p_brick_quantity,
         updated_at = now()
   where product_type = 'BRICKS' and organization_id = v_org and branch_id = v_branch;
  if not found then
    raise exception 'No bricks inventory record found' using errcode = 'P0002';
  end if;

  delete from public.order_loadmen where order_id = p_order_id;
  foreach v_loadman in array coalesce(p_loadmen, array[]::uuid[])
  loop
    insert into public.order_loadmen (order_id, employee_id, organization_id, branch_id)
    values (p_order_id, v_loadman, v_org, v_branch);
  end loop;
end;
$$;

revoke execute on function public.complete_delivery(uuid, text, integer, text, public.payment_status, numeric, text, text, text, uuid[]) from public, anon;
grant execute on function public.complete_delivery(uuid, text, integer, text, public.payment_status, numeric, text, text, text, uuid[]) to authenticated;

-- Employees: undelivered orders only, and no direct writes to orders or order_loadmen.
drop policy employee_read on public.orders;
create policy employee_read on public.orders
  as permissive for select to authenticated
  using ((select private.is_active_employee()) and delivered is not true);

drop policy employee_deliver on public.orders;
drop policy employee_insert on public.order_loadmen;
drop policy employee_delete on public.order_loadmen;
