-- Migration: Merge UserPreferencesTable into UsersTable
-- Date: 2025-01-06
-- Purpose: Eliminate unnecessary JOINs by storing preferences directly in users table

-- Step 1: Add preference columns to users table (already done in 0009_big_black_cat.sql)
-- ALTER TABLE "users" ADD COLUMN "theme" text DEFAULT 'light' NOT NULL;
-- ALTER TABLE "users" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;
-- ALTER TABLE "users" ADD COLUMN "security_alerts" boolean DEFAULT true NOT NULL;

-- Step 2: Migrate existing preferences data from user_preferences to users
UPDATE users u
SET
  theme = COALESCE(up.theme, 'light'),
  language = COALESCE(up.language, 'en'),
  security_alerts = COALESCE(up.security_alerts, true)
FROM user_preferences up
WHERE u.workos_user_id = up.workos_user_id;

-- Step 3: Verify migration (optional - run this separately to check)
-- SELECT 
--   u.workos_user_id,
--   u.theme,
--   u.language,
--   u.security_alerts,
--   up.theme as old_theme,
--   up.language as old_language,
--   up.security_alerts as old_security_alerts
-- FROM users u
-- LEFT JOIN user_preferences up ON u.workos_user_id = up.workos_user_id
-- LIMIT 10;

-- Step 4: Drop user_preferences table (run this AFTER verifying migration)
-- WARNING: This is irreversible! Make sure to backup data first.
-- DROP TABLE IF EXISTS user_preferences;

-- Notes:
-- - This migration preserves existing user preferences
-- - New users will get default values (light theme, en language, security alerts enabled)
-- - The user_preferences table is kept temporarily for safety
-- - Run the DROP TABLE command only after thorough verification

