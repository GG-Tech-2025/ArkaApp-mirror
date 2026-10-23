-- Phase 5 PR 3b: forced password change for provisioned admins.
--
-- The provision-organization Edge Function creates a client's first admin with
-- app_metadata.must_change_password = true (app_metadata can only be written with the
-- service role, so the user cannot clear it themselves). The app sends anyone carrying
-- the mark to a change-password screen.
--
-- This trigger clears the mark exactly when the password really changes, so the only
-- way to get rid of it is to set a new password. It runs inside the same UPDATE that
-- GoTrue issues for a password change, so the mark and the password cannot disagree.
--
-- Note: an operator who resets someone's password through the admin API and wants them
-- to change it again must set the mark in a separate call afterwards; the same call that
-- changes the password would have the mark cleared by this trigger.

create or replace function private.clear_must_change_password()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and new.raw_app_meta_data ? 'must_change_password' then
    new.raw_app_meta_data := new.raw_app_meta_data - 'must_change_password';
  end if;
  return new;
end;
$$;

create trigger clear_must_change_password
  before update of encrypted_password on auth.users
  for each row
  execute function private.clear_must_change_password();
