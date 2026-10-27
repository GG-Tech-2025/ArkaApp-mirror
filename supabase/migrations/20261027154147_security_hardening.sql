-- Security hardening, found while auditing the atomic-write migrations against all three
-- apps (admin, employee, platform).
--
-- 1. Employees could write stock directly. Phase 6 gave active employees INSERT / UPDATE
--    policies on inventory_stock and product_inventory (and INSERT on production_entries) so
--    that the old browser-side production code could work. Production now goes through
--    record_production_entry, but those policies stayed, so any active employee could still
--    PATCH any stock quantity through the API, bypassing the function entirely.
--    -> record_production_entry becomes SECURITY DEFINER (scoped to the caller's own
--       organization and branch, like complete_delivery) and the employee write policies are
--       dropped. Employees keep read access.
-- 2. Employees could insert a procurement with a made-up payment state. The employee_insert
--    policy on procurements only required approved IS NOT TRUE, so an employee could submit a
--    row that already looked paid (total_paid / payment_status) and hide a payable.
--    -> the policy now also requires the unpaid defaults and created_by = the caller.
-- 3. The anonymous (signed-out) role had every privilege, including TRUNCATE (which row-level
--    security does not cover), on every table and view, and could execute five reporting
--    functions. RLS had no policy for anon so nothing leaked, but there is no reason for the
--    privileges to exist. -> revoked; the defaults for future tables no longer grant them.
--    Signed-in users lose only TRUNCATE / TRIGGER / REFERENCES, which the app never uses.

-- ------------------------------------------------------------------
-- 1. Production entry without direct employee writes
-- ------------------------------------------------------------------

-- Same behaviour as before (see 20261026181153_atomic_remaining_writes.sql), but it now runs
-- with the owner's rights, so every statement is scoped to the caller's organization and
-- branch explicitly instead of relying on RLS, and the caller must be an admin or an active
-- employee.
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
security definer
set search_path = ''
as $function$
declare
  v_org uuid := (select private.current_org_id());
  v_branch uuid := (select private.active_branch_id());
  v_row public.production_entries;
  v_item record;
  v_material uuid;
begin
  if not ((select private.is_admin()) or (select private.is_active_employee())) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_org is null or v_branch is null then
    raise exception 'No active branch' using errcode = '42501';
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
    organization_id, branch_id, production_date, round, bricks, wet_ash_kg, marble_powder_kg,
    crusher_powder_kg, fly_ash_kg, cement_bags, notes, created_by
  )
  values (
    v_org, v_branch, p_production_date, p_round, p_bricks, p_wet_ash_kg, p_marble_powder_kg,
    p_crusher_powder_kg, p_fly_ash_kg, p_cement_bags, p_notes, (select auth.uid())
  )
  returning * into v_row;

  insert into public.product_inventory (organization_id, branch_id, product_type, quantity, updated_at)
  values (v_org, v_branch, 'BRICKS', p_bricks, now())
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
    where m.organization_id = v_org
      and m.branch_id = v_branch
      and lower(m.name) like '%' || v_item.pattern || '%'
    order by m.name
    limit 1;
    continue when v_material is null;

    insert into public.inventory_stock (organization_id, branch_id, material_id, quantity, updated_at)
    values (v_org, v_branch, v_material, -v_item.qty, now())
    on conflict (material_id) do update
      set quantity = public.inventory_stock.quantity - v_item.qty,
          updated_at = now();
  end loop;

  return v_row;
end;
$function$;

-- Employees keep reading stock; they no longer write it.
drop policy employee_insert on public.inventory_stock;
drop policy employee_update on public.inventory_stock;
drop policy employee_insert on public.product_inventory;
drop policy employee_update on public.product_inventory;
drop policy employee_insert on public.production_entries;

-- ------------------------------------------------------------------
-- 2. Employee-submitted procurements are always unpaid and unapproved
-- ------------------------------------------------------------------
drop policy employee_insert on public.procurements;
create policy employee_insert on public.procurements
  as permissive for insert to authenticated
  with check (
    (select private.is_active_employee())
    and approved is not true
    and rate_per_unit = 0
    and total_price = 0
    and coalesce(total_paid, 0) = 0
    and coalesce(payment_status, 'NOT_PAID') = 'NOT_PAID'
    and created_by = (select auth.uid())
  );

-- ------------------------------------------------------------------
-- 3. Nothing for the signed-out role; no TRUNCATE / TRIGGER / REFERENCES for signed-in users
-- ------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- The reporting functions are SECURITY INVOKER (RLS decides what a caller sees) and are only
-- ever called by signed-in admins.
revoke execute on function public.get_cash_ledger_for_date(date) from public, anon;
revoke execute on function public.get_daily_cash_summary(integer, integer) from public, anon;
revoke execute on function public.get_employee_ledger(uuid, boolean, timestamptz, timestamptz, integer, integer) from public, anon;
revoke execute on function public.get_financial_summary() from public, anon;
revoke execute on function public.get_fixed_salary_employees_for_month(date) from public, anon;
revoke execute on function public.update_app_settings_updated_at() from public, anon;

grant execute on function public.get_cash_ledger_for_date(date) to authenticated;
grant execute on function public.get_daily_cash_summary(integer, integer) to authenticated;
grant execute on function public.get_employee_ledger(uuid, boolean, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_financial_summary() to authenticated;
grant execute on function public.get_fixed_salary_employees_for_month(date) to authenticated;
grant execute on function public.update_app_settings_updated_at() to authenticated;
