-- The must_change_password mark clears exactly when the password changes (pgTAP).
-- Run with `supabase test db`. Everything happens in one rolled-back transaction.
--
--   M1  flagged user (as the Edge Function creates them)
--   M2  user with no mark

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', '45000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated',
   'mcp-m1@test.invalid', 'old-hash-1', now(), '{"provider": "email", "must_change_password": true}', '{}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '45000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated',
   'mcp-m2@test.invalid', 'old-hash-2', now(), '{"provider": "email"}', '{}', now(), now(),
   '', '', '', '', '', '', '', '');

select is((select raw_app_meta_data ->> 'must_change_password' from auth.users where id = '45000000-0000-0000-0000-0000000000f1'),
  'true', 'the provisioned admin starts with the mark');

update auth.users set raw_user_meta_data = '{"note": "unrelated change"}' where id = '45000000-0000-0000-0000-0000000000f1';
select is((select raw_app_meta_data ->> 'must_change_password' from auth.users where id = '45000000-0000-0000-0000-0000000000f1'),
  'true', 'changing something other than the password keeps the mark');

update auth.users set encrypted_password = 'old-hash-1' where id = '45000000-0000-0000-0000-0000000000f1';
select is((select raw_app_meta_data ->> 'must_change_password' from auth.users where id = '45000000-0000-0000-0000-0000000000f1'),
  'true', 'writing the same password back keeps the mark');

update auth.users set encrypted_password = 'new-hash-1' where id = '45000000-0000-0000-0000-0000000000f1';
select ok((select not (raw_app_meta_data ? 'must_change_password') from auth.users where id = '45000000-0000-0000-0000-0000000000f1'),
  'setting a new password clears the mark');
select is((select raw_app_meta_data ->> 'provider' from auth.users where id = '45000000-0000-0000-0000-0000000000f1'),
  'email', 'and leaves the rest of app_metadata alone');

update auth.users set encrypted_password = 'new-hash-2' where id = '45000000-0000-0000-0000-0000000000f2';
select is((select raw_app_meta_data from auth.users where id = '45000000-0000-0000-0000-0000000000f2'),
  '{"provider": "email"}'::jsonb, 'a user without the mark is not touched by a password change');

select is((select count(*) from pg_trigger
           where tgrelid = 'auth.users'::regclass and tgname = 'clear_must_change_password' and not tgisinternal),
  1::bigint, 'the trigger exists on auth.users');
select is((select (tgtype & 2) > 0 and (tgtype & 16) > 0 from pg_trigger
           where tgrelid = 'auth.users'::regclass and tgname = 'clear_must_change_password'),
  true, 'and it runs before an update');

select * from finish();
rollback;
