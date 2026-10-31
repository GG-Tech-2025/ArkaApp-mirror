-- Migration: Add no_loading_salary flag to roles table
-- Purpose: Allow roles (of any category) to opt out of auto salary entries on delivery.
--          Employees in such roles receive wages only via attendance-based salary calculation.
-- Date: 2025

ALTER TABLE roles
  ADD COLUMN no_loading_salary boolean NOT NULL DEFAULT false;

-- Note: No existing role should have this set to true automatically.
-- Set it manually via the Admin → Role & Salary Setup → Edit Role screen
-- or via Supabase dashboard for existing roles that require it.
