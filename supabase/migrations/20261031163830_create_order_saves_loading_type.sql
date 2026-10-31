-- create_order read the whole order from its payload but its INSERT never listed
-- loading_type, so every order created through it was saved with no load type, whatever the
-- Create Order screen sent. The Edit Order screen then sent an empty load type back and the
-- orders_loading_type_check constraint rejected the update.
--
-- This stores the load type from the payload (LOADING_UNLOADING when the payload has none) and
-- gives the orders already saved without one the same default. Same signature, so the existing
-- grants stay in place.

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
    loading_type, delivered, created_by
  )
  values (
    v_in.customer_id, v_in.order_date, v_in.delivery_date, v_in.brick_quantity,
    v_in.price_per_brick, v_in.paper_price, v_in.final_price, v_in.location,
    coalesce(v_in.payment_status, 'NOT_PAID'), coalesce(v_in.amount_paid, 0),
    v_in.gst_number, v_in.dc_number,
    coalesce(v_in.loading_type, 'LOADING_UNLOADING'),
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

update public.orders
set loading_type = 'LOADING_UNLOADING'
where loading_type is null;
