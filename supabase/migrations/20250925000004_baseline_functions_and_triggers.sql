-- Baseline migration 3/4: functions + triggers
-- Pulled verbatim (pg_get_functiondef) from the live "Arka demo" Supabase project as of 2026-09-25.

CREATE OR REPLACE FUNCTION public.increment_account_balance(p_account_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update accounts
  set balance = balance + p_amount
  where id = p_account_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_account_balance(p_account_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  current_balance numeric;
begin
  select balance
  into current_balance
  from accounts
  where id = p_account_id
  for update;

  if current_balance is null then
    raise exception 'Account not found';
  end if;

  if current_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update accounts
  set balance = balance - p_amount
  where id = p_account_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_vendor_payment_fifo(p_vendor_id uuid, p_payment_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
      and payment_status in ('NOT_PAID','PARTIALLY_PAID')
      and approved = true
    order by date asc
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
    set total_paid = coalesce(total_paid,0) + v_apply,
        payment_status =
          case
            when (coalesce(total_paid,0) + v_apply) >= total_price
              then 'PAID'
            else 'PARTIALLY_PAID'
          end
    where id = v_proc.id;

    v_remaining := v_remaining - v_apply;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_salary_batch(p_month date, p_items json)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
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
      coalesce((v_item->>'present_days')::int,0),
      coalesce((v_item->>'absent_days')::int,0),
      coalesce((v_item->>'leave_days')::int,0),
      coalesce((v_item->>'half_days')::int,0),
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

CREATE OR REPLACE FUNCTION public.update_app_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_employee_ledger(p_employee_id uuid, p_is_ascending boolean, p_from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_page integer DEFAULT 0, p_page_size integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
declare
  v_offset integer;
  v_employee json;
  v_transactions json;
  v_total bigint;
begin

  v_offset := p_page * p_page_size;

  select json_build_object(
    'id', e.id,
    'name', e.name,
    'phone', e.phone,
    'role_name', r.name,
    'role_category', r.category,
    'running_balance',
      coalesce(
        (
          select running_balance
          from salary_ledger
          where employee_id = p_employee_id
          order by created_at desc
          limit 1
        ),
        0
      )
  )
  into v_employee
  from employees e
  left join roles r on r.id = e.role_id
  where e.id = p_employee_id;

  select count(*)
  into v_total
  from salary_ledger
  where employee_id = p_employee_id
    and (p_from_date is null or payment_at >= p_from_date)
    and (p_to_date is null or payment_at <= p_to_date);

  select json_agg(t)
  into v_transactions
  from (
    select
      id,
      entry_type,
      amount,
      payment_mode,
      sender_account_id,
      receiver_account,
      notes,
      payment_at
    from salary_ledger
    where employee_id = p_employee_id
      and (p_from_date is null or payment_at >= p_from_date)
      and (p_to_date is null or payment_at <= p_to_date)
    order by
      case when p_is_ascending then payment_at end asc,
      case when not p_is_ascending then payment_at end desc
    offset v_offset
    limit p_page_size
  ) t;

  return json_build_object(
    'employee', v_employee,
    'transactions', coalesce(v_transactions, '[]'::json),
    'total_count', v_total
  );

end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_vendor_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_vendor_id UUID;
  v_amount NUMERIC;
  v_sender_account_id UUID;
  v_settlement RECORD;
  v_new_paid NUMERIC;
  v_total_price NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT vendor_id, amount, sender_account_id
  INTO v_vendor_id, v_amount, v_sender_account_id
  FROM vendor_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor payment not found: %', p_payment_id;
  END IF;

  FOR v_settlement IN
    SELECT procurement_id, applied_amount
    FROM vendor_procurement_settlements
    WHERE vendor_payment_id = p_payment_id
  LOOP
    UPDATE procurements
    SET total_paid = GREATEST(COALESCE(total_paid, 0) - v_settlement.applied_amount, 0)
    WHERE id = v_settlement.procurement_id;

    SELECT COALESCE(total_paid, 0), total_price
    INTO v_new_paid, v_total_price
    FROM procurements
    WHERE id = v_settlement.procurement_id;

    IF v_new_paid <= 0 THEN
      v_new_status := 'NOT_PAID';
    ELSIF v_new_paid >= v_total_price THEN
      v_new_status := 'PAID';
    ELSE
      v_new_status := 'PARTIALLY_PAID';
    END IF;

    UPDATE procurements
    SET payment_status = v_new_status
    WHERE id = v_settlement.procurement_id;
  END LOOP;

  DELETE FROM vendor_procurement_settlements
  WHERE vendor_payment_id = p_payment_id;

  IF v_sender_account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance + v_amount
    WHERE id = v_sender_account_id;
  END IF;

  DELETE FROM vendor_payments
  WHERE id = p_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_financial_summary()
 RETURNS json
 LANGUAGE sql
AS $function$
select json_build_object(
  'total_receivables',
    coalesce((
      select sum(outstanding_amount)
      from customer_financials
    ), 0),

  'total_vendor_payables',
    coalesce((
      select sum(outstanding_balance)
      from vendor_financials
    ), 0),

  'total_loan_outstanding',
    coalesce((
      select sum(outstanding_balance)
      from loans
      where status = 'ACTIVE'
    ), 0),

  'total_salary_payable',
    coalesce((
      select sum(balance)
      from (
        select
          coalesce((
            select running_balance
            from salary_ledger sl
            where sl.employee_id = e.id
            order by sl.created_at desc
            limit 1
          ), 0) as balance
        from employees e
      ) t
      where balance > 0
    ), 0)

);
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_cash_summary(p_page integer DEFAULT 0, p_page_size integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_min_date DATE := '2026-04-14'::DATE;
  v_today DATE := (timezone('Asia/Kolkata', now()))::date;
  v_total_days INT;
  v_result JSON;
BEGIN
  v_end_date := v_today - (p_page * p_page_size);
  v_start_date := GREATEST(v_end_date - (p_page_size - 1), v_min_date);

  v_total_days := v_today - v_min_date + 1;

  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(day_row ORDER BY day_row->>'date' DESC)
      FROM (
        SELECT json_build_object(
          'date', d.dt::TEXT,
          'cash_in', COALESCE(ci.total, 0),
          'cash_out', COALESCE(co.total, 0)
        ) AS day_row
        FROM generate_series(v_start_date, v_end_date, '1 day'::INTERVAL) AS d(dt)

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM (
            SELECT amount
            FROM loan_ledger
            WHERE transaction_type = 'DISBURSEMENT'
              AND transaction_date = d.dt

            UNION ALL

            SELECT amount
            FROM customer_payments
            WHERE payment_date = d.dt
          ) sub_in
        ) ci ON TRUE

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM (
            SELECT amount
            FROM expenses
            WHERE expense_date = d.dt

            UNION ALL

            SELECT amount
            FROM salary_ledger
            WHERE (payment_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = d.dt
              AND entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

            UNION ALL

            SELECT amount
            FROM vendor_payments
            WHERE payment_date = d.dt

            UNION ALL

            SELECT amount
            FROM loan_ledger
            WHERE transaction_type IN ('REPAYMENT', 'INTEREST')
              AND transaction_date = d.dt
          ) sub_out
        ) co ON TRUE

      ) wrapped
    ), '[]'::JSON),

    'total_days', v_total_days,
    'has_more', ((p_page + 1) * p_page_size) < v_total_days
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_cash_ledger_for_date(p_date date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'cash_in_entries', COALESCE((
      SELECT json_agg(entry ORDER BY entry->>'created_at' DESC)
      FROM (
        SELECT json_build_object(
          'id', ll.id,
          'source_type', 'Loan Disbursement',
          'description', l.lender_name || ' (' || l.loan_type || ')',
          'amount', ll.amount,
          'receiver_account_id', ll.sender_account_id,
          'receiver_account_number', COALESCE(a.account_number, 'Unknown'),
          'payment_mode', ll.payment_mode,
          'notes', ll.notes,
          'created_at', ll.created_at
        ) AS entry
        FROM loan_ledger ll
        JOIN loans l ON l.id = ll.loan_id
        LEFT JOIN accounts a ON a.id = ll.sender_account_id
        WHERE ll.transaction_type = 'DISBURSEMENT'
          AND ll.transaction_date = p_date

        UNION ALL

        SELECT json_build_object(
          'id', cp.id,
          'source_type', 'Customer Payment',
          'description', c.name || ' (' || c.phone || ')',
          'amount', cp.amount,
          'receiver_account_id', cp.receiver_account_id,
          'receiver_account_number', COALESCE(a.account_number, 'Unknown'),
          'payment_mode', cp.mode,
          'notes', NULL,
          'created_at', cp.created_at
        ) AS entry
        FROM customer_payments cp
        JOIN customers c ON c.id = cp.customer_id
        LEFT JOIN accounts a ON a.id = cp.receiver_account_id
        WHERE cp.payment_date = p_date
      ) wrapped
    ), '[]'::JSON),

    'cash_out_entries', COALESCE((
      SELECT json_agg(entry ORDER BY entry->>'created_at' DESC)
      FROM (
        SELECT json_build_object(
          'id', e.id,
          'payment_type', 'Expense',
          'description', COALESCE(et.name, 'Unknown') || ' - ' || COALESCE(es.name, ''),
          'amount', e.amount,
          'sender_account_id', e.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', e.payment_mode,
          'notes', e.comments,
          'created_at', e.created_at
        ) AS entry
        FROM expenses e
        LEFT JOIN expense_types et ON et.id = e.type_id
        LEFT JOIN expense_subtypes es ON es.id = e.subtype_id
        LEFT JOIN accounts a ON a.id = e.sender_account_id
        WHERE e.expense_date = p_date

        UNION ALL

        SELECT json_build_object(
          'id', sl.id,
          'payment_type', 'Salary Payment',
          'description', emp.name || ' (' || sl.entry_type || ')',
          'amount', sl.amount,
          'sender_account_id', sl.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', sl.payment_mode,
          'notes', sl.notes,
          'created_at', sl.payment_at
        ) AS entry
        FROM salary_ledger sl
        JOIN employees emp ON emp.id = sl.employee_id
        LEFT JOIN accounts a ON a.id = sl.sender_account_id
        WHERE sl.payment_at::DATE = p_date
          AND sl.entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

        UNION ALL

        SELECT json_build_object(
          'id', vp.id,
          'payment_type', 'Vendor Payment',
          'description', v.name,
          'amount', vp.amount,
          'sender_account_id', vp.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', vp.mode,
          'notes', NULL,
          'created_at', vp.created_at
        ) AS entry
        FROM vendor_payments vp
        JOIN vendors v ON v.id = vp.vendor_id
        LEFT JOIN accounts a ON a.id = vp.sender_account_id
        WHERE vp.payment_date = p_date

        UNION ALL

        SELECT json_build_object(
          'id', ll.id,
          'payment_type', CASE
            WHEN ll.transaction_type = 'REPAYMENT' THEN 'Loan Repayment'
            ELSE 'Loan Interest'
          END,
          'description', l.lender_name || ' (' || l.loan_type || ')',
          'amount', ll.amount,
          'sender_account_id', ll.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', ll.payment_mode,
          'notes', ll.notes,
          'created_at', ll.created_at
        ) AS entry
        FROM loan_ledger ll
        JOIN loans l ON l.id = ll.loan_id
        LEFT JOIN accounts a ON a.id = ll.sender_account_id
        WHERE ll.transaction_type IN ('REPAYMENT', 'INTEREST')
          AND ll.transaction_date = p_date
      ) wrapped
    ), '[]'::JSON),

    'cash_in_by_account', COALESCE((
      SELECT json_agg(
        json_build_object(
          'account_id', sub.receiver_account_id,
          'account_number', sub.account_number,
          'total', sub.total
        )
      )
      FROM (
        SELECT
          agg.receiver_account_id,
          COALESCE(a.account_number, 'Unknown') AS account_number,
          SUM(agg.amount) AS total
        FROM (
          SELECT sender_account_id AS receiver_account_id, amount
          FROM loan_ledger
          WHERE transaction_type = 'DISBURSEMENT'
            AND transaction_date = p_date

          UNION ALL

          SELECT receiver_account_id, amount
          FROM customer_payments
          WHERE payment_date = p_date
        ) agg
        LEFT JOIN accounts a ON a.id = agg.receiver_account_id
        GROUP BY agg.receiver_account_id, a.account_number
      ) sub
    ), '[]'::JSON),

    'cash_out_by_account', COALESCE((
      SELECT json_agg(
        json_build_object(
          'account_id', sub.sender_account_id,
          'account_number', sub.account_number,
          'total', sub.total
        )
      )
      FROM (
        SELECT
          agg.sender_account_id,
          COALESCE(a.account_number, 'Cash') AS account_number,
          SUM(agg.amount) AS total
        FROM (
          SELECT sender_account_id, amount
          FROM expenses
          WHERE expense_date = p_date

          UNION ALL

          SELECT sender_account_id, amount
          FROM salary_ledger
          WHERE payment_at::DATE = p_date
            AND entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

          UNION ALL

          SELECT sender_account_id, amount
          FROM vendor_payments
          WHERE payment_date = p_date

          UNION ALL

          SELECT sender_account_id, amount
          FROM loan_ledger
          WHERE transaction_type IN ('REPAYMENT', 'INTEREST')
            AND transaction_date = p_date
        ) agg
        LEFT JOIN accounts a ON a.id = agg.sender_account_id
        GROUP BY agg.sender_account_id, a.account_number
      ) sub
    ), '[]'::JSON),

    'total_cash_in', COALESCE((
      SELECT SUM(amount) FROM (
        SELECT amount FROM loan_ledger
        WHERE transaction_type = 'DISBURSEMENT' AND transaction_date = p_date
        UNION ALL
        SELECT amount FROM customer_payments
        WHERE payment_date = p_date
      ) t
    ), 0),

    'total_cash_out', COALESCE((
      SELECT SUM(amount) FROM (
        SELECT amount FROM expenses WHERE expense_date = p_date

        UNION ALL

        SELECT amount FROM salary_ledger
        WHERE payment_at::DATE = p_date
          AND entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

        UNION ALL

        SELECT amount FROM vendor_payments WHERE payment_date = p_date

        UNION ALL

        SELECT amount FROM loan_ledger
        WHERE transaction_type IN ('REPAYMENT', 'INTEREST')
          AND transaction_date = p_date
      ) t
    ), 0)

  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_fixed_salary_employees_for_month(p_month date)
 RETURNS json
 LANGUAGE sql
AS $function$
with date_range as (
  select
    (date_trunc('month', p_month - interval '1 month'))::date as start_date,
    (date_trunc('month', p_month) - interval '1 day')::date as end_date
),

employees_filtered as (
  select
    e.id,
    e.name,
    e.phone,
    r.salary_value as base_salary
  from employees e
  join roles r on r.id = e.role_id
  where r.category = 'FIXED'
    and e.active = true
),

attendance_summary as (
  select
    a.employee_id,
    count(*) filter (where a.status = 'PRESENT') as present_days,
    count(*) filter (where a.status = 'ABSENT') as absent_days,
    count(*) filter (where a.status = 'LEAVE') as leave_days,
    count(*) filter (where a.status = 'HALF_DAY') as half_days
  from attendance a
  cross join date_range d
  where a.date >= d.start_date
    and a.date <= d.end_date
  group by a.employee_id
)

select json_agg(
  json_build_object(
    'employee_id', e.id,
    'name', e.name,
    'phone', e.phone,
    'present_days', coalesce(a.present_days,0),
    'absent_days', coalesce(a.absent_days,0),
    'leave_days', coalesce(a.leave_days,0),
    'half_days', coalesce(a.half_days,0),
    'base_salary', e.base_salary
  )
)
from employees_filtered e
left join attendance_summary a
  on a.employee_id = e.id;
$function$;

CREATE OR REPLACE FUNCTION public.apply_customer_writeoff_fifo(p_customer_id uuid, p_writeoff_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  remaining_amount numeric := p_amount;
  o RECORD;
BEGIN
  FOR o IN
    SELECT
      id,
      final_price,
      COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) AS settled
    FROM orders
    WHERE customer_id = p_customer_id
      AND delivered = true
      AND final_price > COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0)
    ORDER BY order_date ASC
  LOOP
    EXIT WHEN remaining_amount <= 0;

    IF remaining_amount >= (o.final_price - o.settled) THEN
      UPDATE orders
      SET written_off_amount = COALESCE(written_off_amount, 0) + (o.final_price - o.settled)
      WHERE id = o.id;

      remaining_amount := remaining_amount - (o.final_price - o.settled);
    ELSE
      UPDATE orders
      SET written_off_amount = COALESCE(written_off_amount, 0) + remaining_amount
      WHERE id = o.id;

      remaining_amount := 0;
    END IF;
  END LOOP;

  UPDATE orders
  SET payment_status =
    CASE
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) = 0
        THEN 'NOT_PAID'::payment_status
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) < final_price
        THEN 'PARTIALLY_PAID'::payment_status
      ELSE
        'FULLY_PAID'::payment_status
    END
  WHERE customer_id = p_customer_id
    AND delivered = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_customer_writeoff(p_writeoff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_customer_id uuid;
  v_remaining numeric;
  o RECORD;
  w RECORD;
BEGIN
  SELECT customer_id
  INTO v_customer_id
  FROM customer_writeoffs
  WHERE id = p_writeoff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Write-off not found: %', p_writeoff_id;
  END IF;

  DELETE FROM customer_writeoffs
  WHERE id = p_writeoff_id;

  UPDATE orders
  SET written_off_amount = 0
  WHERE customer_id = v_customer_id
    AND delivered = true;

  FOR w IN
    SELECT id, amount
    FROM customer_writeoffs
    WHERE customer_id = v_customer_id
    ORDER BY write_off_date ASC, created_at ASC
  LOOP
    v_remaining := w.amount;

    FOR o IN
      SELECT id, final_price, COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) AS settled
      FROM orders
      WHERE customer_id = v_customer_id
        AND delivered = true
        AND final_price > COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0)
      ORDER BY order_date ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      IF v_remaining >= (o.final_price - o.settled) THEN
        UPDATE orders
        SET written_off_amount = COALESCE(written_off_amount, 0) + (o.final_price - o.settled)
        WHERE id = o.id;

        v_remaining := v_remaining - (o.final_price - o.settled);
      ELSE
        UPDATE orders
        SET written_off_amount = COALESCE(written_off_amount, 0) + v_remaining
        WHERE id = o.id;

        v_remaining := 0;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE orders
  SET payment_status =
    CASE
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) = 0
        THEN 'NOT_PAID'::payment_status
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) < final_price
        THEN 'PARTIALLY_PAID'::payment_status
      ELSE
        'FULLY_PAID'::payment_status
    END
  WHERE customer_id = v_customer_id
    AND delivered = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_customer_payment_fifo(p_customer_id uuid, p_payment_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  remaining_amount numeric := p_amount;
  o RECORD;
BEGIN
  FOR o IN
    SELECT
      id,
      final_price,
      COALESCE(amount_paid, 0) AS paid,
      COALESCE(written_off_amount, 0) AS written_off
    FROM orders
    WHERE customer_id = p_customer_id
      AND delivered = true
      AND final_price > COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0)
    ORDER BY order_date ASC
  LOOP
    EXIT WHEN remaining_amount <= 0;

    IF remaining_amount >= (o.final_price - o.paid - o.written_off) THEN
      UPDATE orders
      SET amount_paid = final_price - written_off_amount
      WHERE id = o.id;

      remaining_amount := remaining_amount - (o.final_price - o.paid - o.written_off);
    ELSE
      UPDATE orders
      SET amount_paid = o.paid + remaining_amount
      WHERE id = o.id;

      remaining_amount := 0;
    END IF;
  END LOOP;

  UPDATE orders
  SET payment_status =
    CASE
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) = 0
        THEN 'NOT_PAID'::payment_status
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) < final_price
        THEN 'PARTIALLY_PAID'::payment_status
      ELSE
        'FULLY_PAID'::payment_status
    END
  WHERE customer_id = p_customer_id
  AND delivered = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_customer_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_customer_id UUID;
  v_amount numeric;
  v_receiver_account_id UUID;
  v_remaining numeric;
  o RECORD;
  p RECORD;
BEGIN
  SELECT customer_id, amount, receiver_account_id
  INTO v_customer_id, v_amount, v_receiver_account_id
  FROM customer_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  IF v_receiver_account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance - v_amount
    WHERE id = v_receiver_account_id;
  END IF;

  DELETE FROM customer_payments
  WHERE id = p_payment_id;

  UPDATE orders
  SET amount_paid = 0,
      payment_status = 'NOT_PAID'::payment_status
  WHERE customer_id = v_customer_id
    AND delivered = true;

  FOR p IN
    SELECT id, amount
    FROM customer_payments
    WHERE customer_id = v_customer_id
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    v_remaining := p.amount;

    FOR o IN
      SELECT id, final_price, COALESCE(amount_paid, 0) AS paid, COALESCE(written_off_amount, 0) AS written_off
      FROM orders
      WHERE customer_id = v_customer_id
        AND delivered = true
        AND final_price > COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0)
      ORDER BY order_date ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      IF v_remaining >= (o.final_price - o.paid - o.written_off) THEN
        UPDATE orders
        SET amount_paid = final_price - written_off_amount
        WHERE id = o.id;

        v_remaining := v_remaining - (o.final_price - o.paid - o.written_off);
      ELSE
        UPDATE orders
        SET amount_paid = o.paid + v_remaining
        WHERE id = o.id;

        v_remaining := 0;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE orders
  SET payment_status =
    CASE
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) = 0
        THEN 'NOT_PAID'::payment_status
      WHEN COALESCE(amount_paid, 0) + COALESCE(written_off_amount, 0) < final_price
        THEN 'PARTIALLY_PAID'::payment_status
      ELSE
        'FULLY_PAID'::payment_status
    END
  WHERE customer_id = v_customer_id
    AND delivered = true;
END;
$function$;

create trigger trigger_app_settings_updated_at
  before update on public.app_settings
  for each row
  execute function public.update_app_settings_updated_at();
