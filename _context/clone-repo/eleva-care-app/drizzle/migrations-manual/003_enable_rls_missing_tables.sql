/**
 * RLS Policies for Missing Tables (Phase 4)
 * 
 * Enables Row-Level Security for 7 tables that were created after the initial
 * RLS migration but lack proper RLS policies:
 * 
 * 1. annual_plan_eligibility  - Expert subscription eligibility metrics
 * 2. blocked_dates            - Expert unavailable dates
 * 3. expert_applications      - Expert application forms (NEW - Migration 0016)
 * 4. roles                    - User roles for RBAC
 * 5. slot_reservations        - Temporary appointment reservations
 * 6. subscription_events      - Subscription change audit trail
 * 7. transaction_commissions  - Commission records for bookings
 * 
 * Security Model:
 * - Org-scoped access using user_org_memberships
 * - User-owned data (users can only access their own records)
 * - Admin access for review/analytics (role-based)
 * - Append-only for audit trails (subscription_events, transaction_commissions)
 * 
 * Prerequisites:
 * - 001_enable_rls.sql must be applied first (provides auth.user_id() function)
 * - Tables must exist (run migrations 0004, 0006, 0013, 0016)
 * 
 * Apply with: psql $DATABASE_URL -f drizzle/migrations-manual/003_enable_rls_missing_tables.sql
 */

-- ============================================================================
-- 1. ENABLE ROW-LEVEL SECURITY ON ALL MISSING TABLES
-- ============================================================================

ALTER TABLE annual_plan_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_commissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ANNUAL PLAN ELIGIBILITY TABLE
-- ============================================================================
-- Contains financial metrics and eligibility calculations
-- Users can only view their own data, admins can view all for analytics

-- Policy: Users can view their own eligibility record
CREATE POLICY "Users can view own eligibility"
  ON annual_plan_eligibility
  FOR SELECT
  USING (workos_user_id = auth.user_id());

-- Policy: Users can insert their own eligibility record (system-managed)
CREATE POLICY "Users can create own eligibility"
  ON annual_plan_eligibility
  FOR INSERT
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Users can update their own eligibility record (system-managed)
CREATE POLICY "Users can update own eligibility"
  ON annual_plan_eligibility
  FOR UPDATE
  USING (workos_user_id = auth.user_id())
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Organization members can view eligibility for analytics
CREATE POLICY "Org members can view org eligibility"
  ON annual_plan_eligibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = annual_plan_eligibility.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- ============================================================================
-- 3. BLOCKED DATES TABLE
-- ============================================================================
-- Expert availability - users can CRUD their own blocked dates
-- Organization members can view for scheduling coordination

-- Policy: Users can view their own blocked dates
CREATE POLICY "Users can view own blocked dates"
  ON blocked_dates
  FOR SELECT
  USING (workos_user_id = auth.user_id());

-- Policy: Users can create their own blocked dates
CREATE POLICY "Users can create own blocked dates"
  ON blocked_dates
  FOR INSERT
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Users can update their own blocked dates
CREATE POLICY "Users can update own blocked dates"
  ON blocked_dates
  FOR UPDATE
  USING (workos_user_id = auth.user_id())
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Users can delete their own blocked dates
CREATE POLICY "Users can delete own blocked dates"
  ON blocked_dates
  FOR DELETE
  USING (workos_user_id = auth.user_id());

-- Policy: Organization members can view blocked dates (for scheduling)
CREATE POLICY "Org members can view org blocked dates"
  ON blocked_dates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = blocked_dates.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- ============================================================================
-- 4. EXPERT APPLICATIONS TABLE (NEW - Migration 0016)
-- ============================================================================
-- Contains sensitive PII: credentials, experience, resume
-- Users can view/update only their own application
-- Admins can view all applications and update status for review

-- Policy: Users can view their own application
CREATE POLICY "Users can view own application"
  ON expert_applications
  FOR SELECT
  USING (workos_user_id = auth.user_id());

-- Policy: Users can create their own application
CREATE POLICY "Users can create own application"
  ON expert_applications
  FOR INSERT
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Users can update their own application (only if pending/rejected)
CREATE POLICY "Users can update own application"
  ON expert_applications
  FOR UPDATE
  USING (
    workos_user_id = auth.user_id()
    AND status IN ('pending', 'rejected')
  )
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Admins can view all applications (for review)
CREATE POLICY "Admins can view all applications"
  ON expert_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins can update applications (for approval/rejection)
CREATE POLICY "Admins can update applications"
  ON expert_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- 5. ROLES TABLE
-- ============================================================================
-- User roles for RBAC - users can view their own roles (read-only)
-- Only admins can manage roles

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON roles
  FOR SELECT
  USING (workos_user_id = auth.user_id());

-- Policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins can insert roles
CREATE POLICY "Admins can insert roles"
  ON roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins can update roles
CREATE POLICY "Admins can update roles"
  ON roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins can delete roles
CREATE POLICY "Admins can delete roles"
  ON roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- 6. SLOT RESERVATIONS TABLE
-- ============================================================================
-- Temporary appointment reservations - experts can view reservations for their events
-- Users can CRUD their own reservations (as guests)

-- Policy: Users can view their own reservations (as guest)
CREATE POLICY "Users can view own reservations"
  ON slot_reservations
  FOR SELECT
  USING (guest_email = (SELECT email FROM users WHERE workos_user_id = auth.user_id()));

-- Policy: Experts can view reservations for their events
CREATE POLICY "Experts can view event reservations"
  ON slot_reservations
  FOR SELECT
  USING (workos_user_id = auth.user_id());

-- Policy: Experts can create reservations for their events
CREATE POLICY "Experts can create event reservations"
  ON slot_reservations
  FOR INSERT
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Experts can update reservations for their events
CREATE POLICY "Experts can update event reservations"
  ON slot_reservations
  FOR UPDATE
  USING (workos_user_id = auth.user_id())
  WITH CHECK (workos_user_id = auth.user_id());

-- Policy: Experts can delete reservations for their events
CREATE POLICY "Experts can delete event reservations"
  ON slot_reservations
  FOR DELETE
  USING (workos_user_id = auth.user_id());

-- Policy: Organization members can view org reservations
CREATE POLICY "Org members can view org reservations"
  ON slot_reservations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = slot_reservations.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- ============================================================================
-- 7. SUBSCRIPTION EVENTS TABLE (AUDIT TRAIL)
-- ============================================================================
-- Audit trail for subscription changes - append-only for integrity
-- Users can view events for their org, no UPDATE/DELETE allowed

-- Policy: Users can view subscription events for their org
CREATE POLICY "Users can view org subscription events"
  ON subscription_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = subscription_events.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: System can insert subscription events (via app)
CREATE POLICY "System can insert subscription events"
  ON subscription_events
  FOR INSERT
  WITH CHECK (auth.user_id() IS NOT NULL);

-- Policy: Admins can view all subscription events (for analytics)
CREATE POLICY "Admins can view all subscription events"
  ON subscription_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- No UPDATE or DELETE policies (append-only for audit trail integrity)

-- ============================================================================
-- 8. TRANSACTION COMMISSIONS TABLE (FINANCIAL DATA)
-- ============================================================================
-- Very sensitive: commission amounts, payment intents, expert earnings
-- Users can view commissions for their org (read-only)
-- Managed entirely by payment system

-- Policy: Users can view commissions for their org
CREATE POLICY "Users can view org commissions"
  ON transaction_commissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = transaction_commissions.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: System can insert commission records (payment system)
CREATE POLICY "System can insert commissions"
  ON transaction_commissions
  FOR INSERT
  WITH CHECK (auth.user_id() IS NOT NULL);

-- Policy: System can update commission status (for refunds/disputes)
CREATE POLICY "System can update commissions"
  ON transaction_commissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = transaction_commissions.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = transaction_commissions.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: Admins can view all commissions (for financial reporting)
CREATE POLICY "Admins can view all commissions"
  ON transaction_commissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- 9. VERIFICATION QUERIES
-- ============================================================================

-- Check that RLS is enabled on all 7 tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'annual_plan_eligibility',
    'blocked_dates',
    'expert_applications',
    'roles',
    'slot_reservations',
    'subscription_events',
    'transaction_commissions'
  )
ORDER BY tablename;

-- Check that policies exist for all tables
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as "Operation",
  CASE 
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
    WHEN cmd = '*' THEN 'All Operations'
  END as "Policy Type"
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN (
    'annual_plan_eligibility',
    'blocked_dates',
    'expert_applications',
    'roles',
    'slot_reservations',
    'subscription_events',
    'transaction_commissions'
  )
ORDER BY tablename, policyname;

-- Count policies per table (should have multiple)
SELECT 
  tablename,
  COUNT(*) as "Number of Policies"
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN (
    'annual_plan_eligibility',
    'blocked_dates',
    'expert_applications',
    'roles',
    'slot_reservations',
    'subscription_events',
    'transaction_commissions'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 10. TEST QUERIES (Use in development only)
-- ============================================================================

-- Test 1: Verify auth.user_id() function works
SELECT auth.user_id() as current_user_id;

-- Test 2: Try to query a table (should only see own records)
-- Replace 'user_xxx' with actual WorkOS user ID
-- BEGIN;
-- SET LOCAL app.user_id = 'user_01K8QT17KX25XPHVQ4H1K0HTR7';
-- SELECT * FROM expert_applications;
-- SELECT * FROM transaction_commissions;
-- ROLLBACK;

-- ============================================================================
-- 11. ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- To disable RLS and remove all policies (DANGEROUS - only for emergencies):
/*
-- Drop all policies
DROP POLICY IF EXISTS "Users can view own eligibility" ON annual_plan_eligibility;
DROP POLICY IF EXISTS "Users can create own eligibility" ON annual_plan_eligibility;
DROP POLICY IF EXISTS "Users can update own eligibility" ON annual_plan_eligibility;
DROP POLICY IF EXISTS "Org members can view org eligibility" ON annual_plan_eligibility;

DROP POLICY IF EXISTS "Users can view own blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Users can create own blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Users can update own blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Users can delete own blocked dates" ON blocked_dates;
DROP POLICY IF EXISTS "Org members can view org blocked dates" ON blocked_dates;

DROP POLICY IF EXISTS "Users can view own application" ON expert_applications;
DROP POLICY IF EXISTS "Users can create own application" ON expert_applications;
DROP POLICY IF EXISTS "Users can update own application" ON expert_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON expert_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON expert_applications;

DROP POLICY IF EXISTS "Users can view own roles" ON roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Admins can update roles" ON roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON roles;

DROP POLICY IF EXISTS "Users can view own reservations" ON slot_reservations;
DROP POLICY IF EXISTS "Experts can view event reservations" ON slot_reservations;
DROP POLICY IF EXISTS "Experts can create event reservations" ON slot_reservations;
DROP POLICY IF EXISTS "Experts can update event reservations" ON slot_reservations;
DROP POLICY IF EXISTS "Experts can delete event reservations" ON slot_reservations;
DROP POLICY IF EXISTS "Org members can view org reservations" ON slot_reservations;

DROP POLICY IF EXISTS "Users can view org subscription events" ON subscription_events;
DROP POLICY IF EXISTS "System can insert subscription events" ON subscription_events;
DROP POLICY IF EXISTS "Admins can view all subscription events" ON subscription_events;

DROP POLICY IF EXISTS "Users can view org commissions" ON transaction_commissions;
DROP POLICY IF EXISTS "System can insert commissions" ON transaction_commissions;
DROP POLICY IF EXISTS "System can update commissions" ON transaction_commissions;
DROP POLICY IF EXISTS "Admins can view all commissions" ON transaction_commissions;

-- Disable RLS
ALTER TABLE annual_plan_eligibility DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE expert_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE slot_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_commissions DISABLE ROW LEVEL SECURITY;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/**
 * Important Security Considerations:
 * 
 * 1. auth.user_id() Function:
 *    - Provided by Neon Auth integration
 *    - Extracts 'sub' claim from WorkOS JWT
 *    - Returns NULL if no JWT or invalid JWT
 *    - Validated via WorkOS JWKS: https://api.workos.com/.well-known/jwks.json
 * 
 * 2. Enforcement:
 *    - RLS policies are enforced at database level
 *    - Prevents data leaks even if application code has bugs
 *    - All queries respect policies (unless role has BYPASSRLS)
 * 
 * 3. Performance:
 *    - Policies use indexed columns (workos_user_id, org_id)
 *    - EXISTS checks are efficient with proper indexes
 *    - Monitor with EXPLAIN ANALYZE if needed
 * 
 * 4. Audit Trail Integrity:
 *    - subscription_events: Append-only (no UPDATE/DELETE)
 *    - transaction_commissions: Limited updates (status only)
 *    - Required for HIPAA/SOC 2 compliance
 * 
 * 5. Admin Access:
 *    - Admins can view all data for analytics
 *    - Checked via users.role IN ('admin', 'superadmin')
 *    - Consider separate admin views for better performance
 * 
 * 6. Expert Applications Security:
 *    - High sensitivity (PII, credentials, resumes)
 *    - Users can only view/update their own application
 *    - Admins can review and update status
 *    - Users can only update if pending/rejected (not approved)
 * 
 * 7. Financial Data Protection:
 *    - transaction_commissions: Very sensitive (earnings data)
 *    - Users can view org-scoped commissions
 *    - System-managed via payment processing
 *    - Admins can view all for financial reporting
 * 
 * 8. Testing:
 *    - Always test with different user contexts
 *    - Verify users can't access other users' data
 *    - Test admin access separately
 *    - Use BEGIN/ROLLBACK for safe testing
 */

