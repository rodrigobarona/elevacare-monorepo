/**
 * RLS Policies for subscription_plans Table
 * 
 * This table was missed in the initial RLS migrations (001 and 003).
 * subscription_plans is organization-owned with subscription and billing management.
 * 
 * Security Model:
 * - Org members can view their org's subscription
 * - Billing admin can update subscription settings
 * - Only org owners/admins can create/manage subscriptions
 * - Only org owners can delete subscriptions (rare, for cleanup)
 * - Platform admins can view all subscriptions for analytics
 * 
 * Prerequisites:
 * - 001_enable_rls.sql must be applied first (provides auth.user_id() function)
 * - subscription_plans table must exist (migration 0015)
 * 
 * Apply with: 
 *   psql $DATABASE_URL -f drizzle/migrations-manual/004_subscription_plans_rls.sql
 */

-- ============================================================================
-- 1. ENABLE ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. SUBSCRIPTION_PLANS POLICIES
-- ============================================================================
-- Organization subscription plans with billing admin management
-- One subscription per org, org-scoped access

-- Policy: Organization members can view their org's subscription
CREATE POLICY "Org members can view org subscription"
  ON subscription_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = subscription_plans.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: Billing admin can update subscription settings
-- Billing admin is the user who set up the subscription
-- Org owners/admins can also update for delegation
CREATE POLICY "Billing admin can update subscription"
  ON subscription_plans
  FOR UPDATE
  USING (
    billing_admin_user_id = auth.user_id()
    OR EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = subscription_plans.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.role IN ('owner', 'admin')
      AND user_org_memberships.status = 'active'
    )
  )
  WITH CHECK (
    billing_admin_user_id = auth.user_id()
    OR EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = subscription_plans.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.role IN ('owner', 'admin')
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: Org owners and admins can create subscriptions
CREATE POLICY "Org owners can insert subscription"
  ON subscription_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = subscription_plans.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.role IN ('owner', 'admin')
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: Only org owners can delete subscriptions (rare, for cleanup)
CREATE POLICY "Org owners can delete subscription"
  ON subscription_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE user_org_memberships.org_id = subscription_plans.org_id
      AND user_org_memberships.workos_user_id = auth.user_id()
      AND user_org_memberships.role = 'owner'
      AND user_org_memberships.status = 'active'
    )
  );

-- Policy: Platform admins can view all subscriptions (for analytics)
CREATE POLICY "Admins can view all subscriptions"
  ON subscription_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workos_user_id = auth.user_id()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

/**
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'subscription_plans';

-- Verify policies were created
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'subscription_plans'
ORDER BY policyname;

-- Expected: 5 policies
-- 1. Org members can view org subscription (SELECT)
-- 2. Billing admin can update subscription (UPDATE)
-- 3. Org owners can insert subscription (INSERT)
-- 4. Org owners can delete subscription (DELETE)
-- 5. Admins can view all subscriptions (SELECT)
*/

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

/**
-- Drop all policies
DROP POLICY IF EXISTS "Org members can view org subscription" ON subscription_plans;
DROP POLICY IF EXISTS "Billing admin can update subscription" ON subscription_plans;
DROP POLICY IF EXISTS "Org owners can insert subscription" ON subscription_plans;
DROP POLICY IF EXISTS "Org owners can delete subscription" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscription_plans;

-- Disable RLS
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/**
 * Security Considerations:
 * 
 * 1. Billing Admin Role:
 *    - billing_admin_user_id tracks who set up the subscription
 *    - This user has permanent update access (for self-service billing)
 *    - Org owners/admins can also update (for delegation)
 * 
 * 2. Organization Scoping:
 *    - All policies use user_org_memberships for org-level access
 *    - Only active memberships grant access (status = 'active')
 * 
 * 3. Role Hierarchy:
 *    - owner: Can create and delete subscriptions
 *    - admin: Can create and update subscriptions
 *    - member: Can view org subscription (read-only)
 * 
 * 4. Platform Admin Access:
 *    - Admins/superadmins can view all subscriptions
 *    - Useful for analytics, reporting, and support
 * 
 * 5. Deletion Protection:
 *    - Only owners can delete (prevents accidental removal)
 *    - Deletion is rare (usually subscription is canceled, not deleted)
 */

