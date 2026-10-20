-- Phase 4, Step 2: per-branch cash account, per-branch cash-summary start date,
-- duplicate protection for product inventory, and defaults for a new branch.

-- ------------------------------------------------------------------
-- A. Cash account
-- ------------------------------------------------------------------
-- Every branch has one cash account next to its bank accounts. It used to be
-- a single hardcoded UUID in the frontend (plus a second lookup by the name
-- "Cash"). A flag on the row, unique per branch, replaces both: the database
-- guarantees at most one per branch, and the app asks the row instead of
-- knowing an id.
alter table public.accounts
  add column is_cash boolean not null default false;

create unique index accounts_one_cash_per_branch
  on public.accounts (branch_id) where is_cash;

-- ------------------------------------------------------------------
-- B. One finished-goods stock row per product per branch
-- ------------------------------------------------------------------
-- The app creates the BRICKS row on first use ("fetch, insert if missing"),
-- which two overlapping requests could duplicate.
alter table public.product_inventory
  add constraint product_inventory_branch_type_key unique (branch_id, product_type);

-- ------------------------------------------------------------------
-- C. Daily cash summary starts at the branch's own go-live date
-- ------------------------------------------------------------------
-- Was a hardcoded 2026-04-14. Now the active branch's APP_START_DATE setting
-- (RLS already limits app_settings to the active branch, since this function
-- runs as the caller). With no usable setting it falls back to the start of
-- the current year, matching the frontend's own fallback. Otherwise unchanged.
create or replace function public.get_daily_cash_summary(p_page integer default 0, p_page_size integer default 20)
 returns json
 language plpgsql
as $function$
declare
  v_start_date date;
  v_end_date date;
  v_min_date date;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_total_days int;
  v_result json;
begin
  begin
    select s.value::date into v_min_date
    from public.app_settings s
    where s.key = 'APP_START_DATE'
    limit 1;
  exception when others then
    v_min_date := null;
  end;
  v_min_date := coalesce(v_min_date, date_trunc('year', v_today)::date);

  v_end_date := v_today - (p_page * p_page_size);
  v_start_date := greatest(v_end_date - (p_page_size - 1), v_min_date);

  v_total_days := v_today - v_min_date + 1;

  select json_build_object(
    'data', coalesce((
      select json_agg(day_row order by day_row->>'date' desc)
      from (
        select json_build_object(
          'date', d.dt::text,
          'cash_in', coalesce(ci.total, 0),
          'cash_out', coalesce(co.total, 0)
        ) as day_row
        from generate_series(v_start_date, v_end_date, '1 day'::interval) as d(dt)

        left join lateral (
          select coalesce(sum(amount), 0) as total
          from (
            select amount
            from loan_ledger
            where transaction_type = 'DISBURSEMENT'
              and transaction_date = d.dt

            union all

            select amount
            from customer_payments
            where payment_date = d.dt
          ) sub_in
        ) ci on true

        left join lateral (
          select coalesce(sum(amount), 0) as total
          from (
            select amount
            from expenses
            where expense_date = d.dt

            union all

            select amount
            from salary_ledger
            where (payment_at at time zone 'UTC' at time zone 'Asia/Kolkata')::date = d.dt
              and entry_type not in ('AUTO', 'SALARY_AUTO_ENTRY')

            union all

            select amount
            from vendor_payments
            where payment_date = d.dt

            union all

            select amount
            from loan_ledger
            where transaction_type in ('REPAYMENT', 'INTEREST')
              and transaction_date = d.dt
          ) sub_out
        ) co on true

      ) wrapped
    ), '[]'::json),

    'total_days', v_total_days,
    'has_more', ((p_page + 1) * p_page_size) < v_total_days
  ) into v_result;

  return v_result;
end;
$function$;

-- ------------------------------------------------------------------
-- D. Defaults for a new branch
-- ------------------------------------------------------------------
-- What a branch needs before its screens work. Safe to run more than once.
--   * a cash account;
--   * APP_START_DATE (today) and LOADING_AND_UNLOADING_PRICE_PER_BRICK. The
--     price is seeded as 0 on purpose: the delivery screen rejects 0 with
--     "set it in App Settings", so someone must choose the real price rather
--     than inheriting a guess that would silently mis-pay loaders. A setting
--     row has to exist because the settings screen only edits existing rows;
--   * the five raw materials the production and metrics logic finds by name
--     (without them stock deduction is silently skipped).
-- Stock rows and the BRICKS row are created by the app on first use.
--
-- This is provisioning, not something a signed-in user does: only the service
-- role (and the SQL editor) can run it. The Phase 5 control plane will call it.
create or replace function public.seed_branch_defaults(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_today text := to_char((timezone('Asia/Kolkata', now()))::date, 'YYYY-MM-DD');
  m record;
begin
  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id;

  if v_org is null then
    raise exception 'Branch not found' using errcode = 'P0002';
  end if;

  insert into public.accounts (account_number, opening_balance, balance, is_cash, organization_id, branch_id)
  values ('Cash', 0, 0, true, v_org, p_branch_id)
  on conflict (branch_id) where is_cash do nothing;

  insert into public.app_settings (key, value, description, organization_id, branch_id) values
    ('APP_START_DATE', v_today,
     'The date the application went live (YYYY-MM-DD). Used to set the earliest selectable year/date in filters across the app.',
     v_org, p_branch_id),
    ('LOADING_AND_UNLOADING_PRICE_PER_BRICK', '0',
     'Loading/unloading wage per brick. Must be set to a number greater than 0 before deliveries can be submitted.',
     v_org, p_branch_id)
  on conflict (branch_id, key) do nothing;

  for m in
    select * from (values
      ('Wet Ash', 'kg'), ('Marble Powder', 'kg'), ('Crusher Powder', 'kg'),
      ('Fly Ash', 'kg'), ('Cement', 'kg')
    ) as t(name, unit)
  loop
    insert into public.materials (name, unit, organization_id, branch_id)
    select m.name, m.unit, v_org, p_branch_id
    where not exists (
      select 1 from public.materials x
      where x.branch_id = p_branch_id and lower(x.name) = lower(m.name)
    );
  end loop;
end;
$$;

revoke execute on function public.seed_branch_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_branch_defaults(uuid) to service_role;
