-- Add guest user fields to meetings table
-- These fields support the WorkOS guest user auto-registration feature

-- Add guest WorkOS user ID (nullable for legacy meetings)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meetings' AND column_name = 'guest_workos_user_id'
  ) THEN
    ALTER TABLE meetings ADD COLUMN guest_workos_user_id text;
    COMMENT ON COLUMN meetings.guest_workos_user_id IS 'WorkOS user ID of the guest/customer (nullable for legacy meetings)';
  END IF;
END $$;

-- Add guest organization ID (nullable for legacy meetings)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meetings' AND column_name = 'guest_org_id'
  ) THEN
    ALTER TABLE meetings ADD COLUMN guest_org_id uuid;
    COMMENT ON COLUMN meetings.guest_org_id IS 'Organization ID of the guest/customer (nullable for legacy meetings)';
  END IF;
END $$;

-- Add index for guest_workos_user_id for faster lookups
CREATE INDEX IF NOT EXISTS meetings_guest_user_id_idx ON meetings(guest_workos_user_id);

-- Add index for guest_org_id for RLS performance
CREATE INDEX IF NOT EXISTS meetings_guest_org_id_idx ON meetings(guest_org_id);

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('guest_workos_user_id', 'guest_org_id')
ORDER BY column_name;

