-- ================================================================
-- App Settings Table Migration
-- ================================================================
-- Purpose: Store application-wide configuration settings
-- Created: 2026-04-21
-- ================================================================

-- Create app_settings table
CREATE TABLE IF NOT EXISTS "public"."app_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(255) UNIQUE NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON "public"."app_settings"("key");

-- Add comments to table and columns
COMMENT ON TABLE "public"."app_settings" IS 'Application-wide configuration settings';
COMMENT ON COLUMN "public"."app_settings"."id" IS 'Primary key (UUID)';
COMMENT ON COLUMN "public"."app_settings"."key" IS 'Setting key/identifier (unique)';
COMMENT ON COLUMN "public"."app_settings"."value" IS 'Setting value (stored as text)';
COMMENT ON COLUMN "public"."app_settings"."description" IS 'Human-readable description of the setting';
COMMENT ON COLUMN "public"."app_settings"."updated_at" IS 'Timestamp of last update';
COMMENT ON COLUMN "public"."app_settings"."created_at" IS 'Timestamp of creation';

-- Insert initial settings
INSERT INTO "public"."app_settings" (
  "id", 
  "key", 
  "value", 
  "description", 
  "updated_at", 
  "created_at"
) VALUES (
  'd4557f1b-dac6-44c0-abd5-23d998c9a05d', 
  'LOADING_AND_UNLOADING_PRICE_PER_BRICK', 
  '0.334', 
  'Rate per brick for loading/unloading work (₹). Applied equally to all employees doing loading work. Full rate for Loading & Unloading, half rate for Loading Only.', 
  '2026-04-21 03:42:55.712639+00', 
  '2026-04-21 03:42:55.712639+00'
)
ON CONFLICT ("id") DO NOTHING;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before update
DROP TRIGGER IF EXISTS trigger_app_settings_updated_at ON "public"."app_settings";
CREATE TRIGGER trigger_app_settings_updated_at
  BEFORE UPDATE ON "public"."app_settings"
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();

-- Grant appropriate permissions (adjust based on your RLS policies)
-- Example: Allow authenticated users to read, only admins to write
-- ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage settings
-- CREATE POLICY "Admins can manage app settings"
--   ON "public"."app_settings"
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'ADMIN'
--     )
--   );

-- ================================================================
-- End of Migration
-- ================================================================
