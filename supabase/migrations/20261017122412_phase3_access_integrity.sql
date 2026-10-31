-- Phase 3, Step 2: make the rows RLS depends on internally consistent.
--
-- A user_branch_access row, or a profile's default branch, must point at a
-- branch that actually belongs to the stated organization. Without this, a bad
-- row inserted by hand (service role / SQL editor) could grant an org-A user a
-- branch of org B. Composite FKs make that structurally impossible.
--
-- profiles.default_branch_id is nullable (platform super-admins have no org or
-- branch); with the default MATCH SIMPLE rule a NULL in either column skips the
-- check, so that case still works.

alter table public.branches
  add constraint branches_id_org_key unique (id, organization_id);

alter table public.user_branch_access
  add constraint user_branch_access_branch_org_fkey
  foreign key (branch_id, organization_id) references public.branches (id, organization_id);
create index idx_user_branch_access_branch_org on public.user_branch_access using btree (branch_id, organization_id);

alter table public.profiles
  add constraint profiles_default_branch_org_fkey
  foreign key (default_branch_id, organization_id) references public.branches (id, organization_id);
create index idx_profiles_default_branch_org on public.profiles using btree (default_branch_id, organization_id);
