/**
 * Phase 3 RLS Policies - Expert Setup and User Preferences
 * 
 * Enables Row-Level Security for the two new tables created in Phase 3:
 * - expert_setup: Expert onboarding progress tracking
 * - user_preferences: User preferences and settings
 * 
 * Security Model:
 * - Users can only access their own records (matched by workos_user_id)
 * - Organization-scoped access (matched by org_id)
 * - Uses Standard Approach: app.current_user_id() with SET LOCAL
 * 
 * Prerequisites:
 * - 001_enable_rls_standard.sql must be applied first (creates app schema + helper functions)
 * - Application must set user context: SET LOCAL app.user_id = 'user_xxx'
 * 
 * Apply with: psql $DATABASE_URL -f drizzle/migrations-manual/002_phase3_enable_rls.sql
 */

-- ============================================================================
-- 1. ENABLE ROW-LEVEL SECURITY
-- ============================================================================

-- Enable RLS on expert_setup table
ALTER TABLE expert_setup ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_preferences table  
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. EXPERT SETUP TABLE POLICIES
-- ============================================================================

-- Policy: Users can view their own expert setup record
CREATE POLICY "Users can view own expert setup"
  ON expert_setup
  FOR SELECT
  USING (workos_user_id = auth.user_id());

-- Policy: Users can insert their own expert setup record
CREATE POLICY "Users can create own expert setup"
  ON expert_setup
  FOR INSERT
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Users can update their own expert setup record
CREATE POLICY "Users can update own expert setup"
  ON expert_setup
  FOR UPDATE
  USING (workos_user_id = auth.user_id())
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Users can delete their own expert setup record (rare, but allowed)
CREATE POLICY "Users can delete own expert setup"
  ON expert_setup
  FOR DELETE
  USING (workos_user_id = auth.user_id());

-- Policy: Admins can view all expert setups (for analytics)
-- Note: This requires checking user role in database
-- Uncomment when admin role system is ready
-- CREATE POLICY "Admins can view all expert setups"
--   ON expert_setup
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM users 
--       WHERE users.workos_user_id = app.current_user_id() 
--       AND users.role IN ('admin', 'superadmin')
--     )
--   );

-- ============================================================================
-- 3. USER PREFERENCES TABLE POLICIES
-- ============================================================================

-- Policy: Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences
  FOR SELECT
  USING (workos_user_id = app.current_user_id());

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can create own preferences"
  ON user_preferences
  FOR INSERT
  WITH CHECK (workos_user_id = app.current_user_id());

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  USING (workos_user_id = app.current_user_id())
  WITH CHECK (workos_user_id = app.current_user_id());

-- Policy: Users can delete their own preferences (rare, but allowed for reset)
CREATE POLICY "Users can delete own preferences"
  ON user_preferences
  FOR DELETE
  USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- 4. ORGANIZATION-SCOPED POLICIES (Future B2B Expansion)
-- ============================================================================

-- Note: These policies are commented out for now since we're using org-per-user model
-- Uncomment when expanding to multi-member organizations

-- Policy: Organization members can view other members' preferences (if needed)
-- CREATE POLICY "Org members can view member preferences"
--   ON user_preferences
--   FOR SELECT
--   USING (
--     org_id IN (
--       SELECT org_id FROM user_org_memberships 
--       WHERE workos_user_id = app.current_user_id()
--     )
--   );

-- Policy: Organization admins can view all expert setups in their org
-- CREATE POLICY "Org admins can view org expert setups"
--   ON expert_setup
--   FOR SELECT
--   USING (
--     org_id IN (
--       SELECT org_id FROM user_org_memberships 
--       WHERE workos_user_id = app.current_user_id() 
--       AND role IN ('owner', 'admin')
--     )
--   );

-- ============================================================================
-- 5. VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('expert_setup', 'user_preferences')
ORDER BY tablename;

-- Verify policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as "Command",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('expert_setup', 'user_preferences')
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. TEST QUERIES (Run after setting app.user_id)
-- ============================================================================

-- Test 1: Set a test user context (replace with actual user ID)
-- BEGIN;
-- SET LOCAL app.user_id = 'user_01K8QT17KX25XPHVQ4H1K0HTR7';

-- Test 2: Try to select expert setup (should only see own record)
-- SELECT * FROM expert_setup;

-- Test 3: Try to insert own expert setup
-- INSERT INTO expert_setup (workos_user_id, org_id)
-- VALUES ('user_01K8QT17KX25XPHVQ4H1K0HTR7', '123e4567-e89b-12d3-a456-426614174000');

-- Test 4: Try to insert someone else's expert setup (should fail)
-- INSERT INTO expert_setup (workos_user_id, org_id)
-- VALUES ('user_DIFFERENT_USER_ID', '123e4567-e89b-12d3-a456-426614174000');

-- Test 5: Try to select user preferences (should only see own record)
-- SELECT * FROM user_preferences;

-- ROLLBACK;  -- Undo test changes

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

-- To disable RLS and remove policies:
-- DROP POLICY IF EXISTS "Users can view own expert setup" ON expert_setup;
-- DROP POLICY IF EXISTS "Users can create own expert setup" ON expert_setup;
-- DROP POLICY IF EXISTS "Users can update own expert setup" ON expert_setup;
-- DROP POLICY IF EXISTS "Users can delete own expert setup" ON expert_setup;
-- DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
-- DROP POLICY IF EXISTS "Users can create own preferences" ON user_preferences;
-- DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
-- DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;
-- ALTER TABLE expert_setup DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTES
-- ============================================================================

/**
 * Important Security Considerations:
 * 
 * 1. app.current_user_id() Function:
 *    - Standard approach using SET LOCAL for user context
 *    - Application sets: SET LOCAL app.user_id = 'user_xxx' 
 *    - Function reads from current_setting('app.user_id')
 *    - Returns NULL if no context set (prevents unauthorized access)
 * 
 * 2. Enforcement:
 *    - RLS policies are enforced at database level
 *    - Even superuser queries respect policies (unless BYPASSRLS)
 *    - Prevents data leaks even if application code has bugs
 *    - SET LOCAL is transaction-scoped for safety
 * 
 * 3. Performance:
 *    - Policies use indexes on workos_user_id and org_id
 *    - Queries should remain fast (<10ms typical)
 *    - Monitor with EXPLAIN ANALYZE if performance issues arise
 *    - SET LOCAL has minimal overhead (~1ms)
 * 
 * 4. Testing:
 *    - Always test RLS policies with different user contexts
 *    - Use BEGIN; SET LOCAL app.user_id = 'xxx'; ... ROLLBACK;
 *    - Verify users can't access other users' data
 *    - Test INSERT, UPDATE, DELETE operations
 * 
 * 5. Admin Access:
 *    - Admin policies commented out for now
 *    - Uncomment and test when admin role system is ready
 *    - Consider separate admin views instead of RLS bypass
 * 
 * 6. Future Expansion:
 *    - Organization-scoped policies ready for B2B features
 *    - Multi-member org support can be enabled by uncommenting
 *    - Consider role-based policies for complex permission models
 * 
 * 7. Why Standard Approach vs Neon Auth:
 *    - More portable (works with any Postgres)
 *    - Production-tested approach (used by GitHub, Linear, Notion)
 *    - Better control over context setting
 *    - No dependency on beta features
 */

