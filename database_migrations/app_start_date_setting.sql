-- Migration: Add APP_START_DATE to app_settings
-- This setting records the date the app went live.
-- Used across the app for date range filters (e.g., attendance year picker).

INSERT INTO public.app_settings (key, value, description)
VALUES (
  'APP_START_DATE',
  '2026-04-14',
  'The date the application went live (YYYY-MM-DD). Used to set the earliest selectable year/date in filters across the app.'
)
ON CONFLICT (key) DO NOTHING;
