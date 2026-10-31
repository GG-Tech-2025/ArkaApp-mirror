-- Atomic writes, part 3: a delivery together with its loader wages, and a day's attendance
-- together with the salary entries it produces.
--
-- Both used to be a chain of separate calls from the browser:
--   * delivery: complete_delivery (one transaction) and THEN one loader-wage call per loadman.
--     If a wage call failed, the order was already delivered, the wage was missing and a retry
--     failed with "already delivered".
--   * attendance: save the attendance rows, THEN the salary entries and deductions in
--     Promise.all. A failure part-way left attendance saved (the screen then locks the day)
--     with some salary entries missing, and re-saving would have duplicated the ones that
--     had worked.
-- Each is now one function, so the whole action succeeds or none of it does.

-- ------------------------------------------------------------------
-- 1. Delivery + loader wages
-- ------------------------------------------------------------------

-- Same as complete_delivery, plus the wage each eligible loadman earns for the delivery.
-- p_wage_loadmen are the loadmen to credit (they must be among p_loadmen); each gets
-- p_wage_amount via record_loader_wage, in employee-id order so two deliveries finishing at
-- once take the employee locks in the same order and cannot deadlock. With no p_wage_loadmen
-- it behaves exactly like complete_delivery. Callable by an admin or an active employee,
-- like the two functions it calls (which repeat the permission check themselves).
create or replace function public.complete_delivery_with_wages(
  p_order_id uuid,
  p_time text,
  p_brick_quantity integer,
  p_location text,
  p_payment_status public.payment_status,
  p_amount_paid numeric,
  p_gst_number text,
  p_dc_number text,
  p_loading_type text,
  p_loadmen uuid[],
  p_wage_loadmen uuid[] default '{}',
  p_wage_amount numeric default null,
  p_wage_notes text default null,
  p_wage_payment_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee uuid;
begin
  if not ((select private.is_admin()) or (select private.is_active_employee())) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if cardinality(coalesce(p_wage_loadmen, '{}')) > 0 then
    if p_wage_amount is null or p_wage_amount <= 0 then
      raise exception 'Wage amount must be greater than zero' using errcode = '22023';
    end if;
    if exists (
      select 1
      from unnest(p_wage_loadmen) as w
      where w <> all (coalesce(p_loadmen, '{}'))
    ) then
      raise exception 'Wages can only be paid to loadmen on this delivery' using errcode = '22023';
    end if;
  end if;

  perform public.complete_delivery(
    p_order_id, p_time, p_brick_quantity, p_location, p_payment_status, p_amount_paid,
    p_gst_number, p_dc_number, p_loading_type, p_loadmen
  );

  for v_employee in
    select distinct w
    from unnest(coalesce(p_wage_loadmen, '{}')) as w
    order by w
  loop
    perform public.record_loader_wage(v_employee, p_wage_amount, p_wage_notes, p_wage_payment_at);
  end loop;
end;
$function$;

-- ------------------------------------------------------------------
-- 2. Attendance + salary entries
-- ------------------------------------------------------------------

-- Saves one day's attendance and the salary entries that come with it, together.
--
--   p_attendance  [{"employee_id": uuid, "status": "PRESENT"|"ABSENT"|"HALF_DAY"|"LEAVE"}, ...]
--   p_entries     [{"employee_id": uuid, "entry_type": "SALARY_AUTO_ENTRY"|"DEDUCTION",
--                   "amount": number, "notes": text, "payment_at": timestamptz}, ...]
--
-- A day can be saved once: if the branch already has attendance for p_date the call is
-- refused (the screen shows a saved day as read-only), which also stops two admins saving
-- the same day at the same time from crediting everyone twice -- the saves queue on a
-- per-branch, per-date lock and the second one is refused. Entries go through
-- record_salary_ledger_entry, which locks each employee and builds the running balance on
-- their latest entry; they are processed in employee-id order so concurrent callers cannot
-- deadlock. Only wage credits and deductions are accepted here -- no account is touched.
create or replace function public.save_attendance_with_salary(
  p_date date,
  p_attendance jsonb,
  p_entries jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_entry record;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can save attendance' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Date is required' using errcode = '22023';
  end if;
  if p_attendance is null or jsonb_typeof(p_attendance) <> 'array'
     or jsonb_array_length(p_attendance) = 0 then
    raise exception 'No attendance to save' using errcode = '22023';
  end if;
  if p_entries is not null and jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Salary entries must be a list' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('attendance:' || p_date::text || ':' || coalesce((select private.active_branch_id())::text, ''), 0)
  );

  if exists (select 1 from public.attendance a where a.date = p_date) then
    raise exception 'Attendance for this date has already been saved' using errcode = '22023';
  end if;

  insert into public.attendance (employee_id, date, status)
  select (r->>'employee_id')::uuid, p_date, (r->>'status')::public.attendance_status
  from jsonb_array_elements(p_attendance) as r;

  for v_entry in
    select (e.value->>'employee_id')::uuid        as employee_id,
           e.value->>'entry_type'                 as entry_type,
           (e.value->>'amount')::numeric          as amount,
           e.value->>'notes'                      as notes,
           (e.value->>'payment_at')::timestamptz  as payment_at,
           e.ordinality                           as ord
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as e(value, ordinality)
    order by (e.value->>'employee_id')::uuid, e.ordinality
  loop
    if v_entry.entry_type is null or v_entry.entry_type not in ('SALARY_AUTO_ENTRY', 'DEDUCTION') then
      raise exception 'Entry type "%" is not allowed here', coalesce(v_entry.entry_type, '') using errcode = '22023';
    end if;

    perform public.record_salary_ledger_entry(
      v_entry.employee_id,
      v_entry.entry_type::public.salary_entry_type,
      v_entry.amount,
      v_entry.payment_at,
      null,
      null,
      null,
      v_entry.notes
    );
  end loop;
end;
$function$;

-- ------------------------------------------------------------------
-- Grants: signed-in users only
-- ------------------------------------------------------------------
revoke execute on function public.complete_delivery_with_wages(uuid, text, integer, text, public.payment_status, numeric, text, text, text, uuid[], uuid[], numeric, text, timestamptz) from public, anon;
revoke execute on function public.save_attendance_with_salary(date, jsonb, jsonb) from public, anon;

grant execute on function public.complete_delivery_with_wages(uuid, text, integer, text, public.payment_status, numeric, text, text, text, uuid[], uuid[], numeric, text, timestamptz) to authenticated;
grant execute on function public.save_attendance_with_salary(date, jsonb, jsonb) to authenticated;
