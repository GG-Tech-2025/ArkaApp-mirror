-- increment_account_balance used to do nothing, and report nothing, when the account
-- did not exist or belonged to another tenant (RLS hides it, so the update matched
-- no rows). decrement_account_balance already raises 'Account not found'; make the
-- two behave the same so a bad id fails loudly instead of losing the increment.
create or replace function public.increment_account_balance(p_account_id uuid, p_amount numeric)
returns void
language plpgsql
as $function$
begin
  update accounts
  set balance = balance + p_amount
  where id = p_account_id;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$function$;
