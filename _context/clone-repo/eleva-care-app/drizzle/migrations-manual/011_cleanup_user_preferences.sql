-- Migration: Drop user_preferences table after data migration
-- Date: 2025-01-06
-- 
-- ⚠️ IMPORTANT: Run this ONLY AFTER:
-- 1. Running the data migration (MIGRATE-PREFERENCES.sql)
-- 2. Verifying all data was copied successfully
-- 3. Testing the app works without user_preferences table
--
-- This migration:
-- 1. Drops the user_preferences table (CASCADE to remove foreign keys)
-- 2. Verifies the table is gone
--
-- Rollback: If needed, recreate table with schema from git history

-- Step 1: Drop the user_preferences table
DROP TABLE IF EXISTS user_preferences CASCADE;

-- Step 2: Verify table is dropped (should return 0 rows)
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'user_preferences';
-- Expected: 0 rows

-- Step 3: Verify users table has preference columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name IN ('theme', 'language');
-- Expected: 2 rows (theme, language)

-- ✅ Migration complete!
-- User preferences are now stored directly in users table.

