-- Phase 1, Step 4: core tenancy tables.
-- Hierarchy: organizations -> branches -> user_branch_access.
-- Kept deliberately simple (text + check instead of enums) since billing/plan
-- logic is Phase 6 — these columns just need to exist without blocking later work.

create table public.organizations (
  id uuid not null default gen_random_uuid(),
  name text not null,
  slug text not null,
  legal_name text null,
  gst_number character varying(15) null,
  address text null,
  contact_phone character varying(10) null,
  contact_email text null,
  status text not null default 'ACTIVE',
  plan text not null default 'trial',
  trial_ends_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint organizations_pkey primary key (id),
  constraint organizations_slug_key unique (slug),
  constraint organizations_status_check check (status = any (array['ACTIVE'::text, 'SUSPENDED'::text, 'CANCELLED'::text]))
);

create table public.branches (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  code text not null,
  address text null,
  gst_number character varying(15) null,
  status text not null default 'ACTIVE',
  created_at timestamp with time zone not null default now(),
  constraint branches_pkey primary key (id),
  constraint branches_organization_id_fkey foreign key (organization_id) references public.organizations (id),
  constraint branches_org_code_key unique (organization_id, code),
  constraint branches_status_check check (status = any (array['ACTIVE'::text, 'INACTIVE'::text]))
);
create index idx_branches_organization_id on public.branches using btree (organization_id);

create table public.user_branch_access (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  branch_id uuid not null,
  organization_id uuid not null,
  branch_role text not null default 'STAFF',
  created_at timestamp with time zone not null default now(),
  constraint user_branch_access_pkey primary key (id),
  constraint user_branch_access_user_id_fkey foreign key (user_id) references public.profiles (id),
  constraint user_branch_access_branch_id_fkey foreign key (branch_id) references public.branches (id),
  constraint user_branch_access_organization_id_fkey foreign key (organization_id) references public.organizations (id),
  constraint user_branch_access_user_branch_key unique (user_id, branch_id),
  constraint user_branch_access_role_check check (branch_role = any (array['MANAGER'::text, 'STAFF'::text]))
);
create index idx_user_branch_access_user_id on public.user_branch_access using btree (user_id);
create index idx_user_branch_access_branch_id on public.user_branch_access using btree (branch_id);
