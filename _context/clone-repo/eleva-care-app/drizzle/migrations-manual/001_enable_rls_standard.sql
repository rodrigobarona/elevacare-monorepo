/**
 * Row-Level Security (RLS) Policies for WorkOS Migration
 * Standard Approach: Using SET LOCAL for user context
 * 
 * This approach uses application-set session variables instead of JWT extraction.
 * More portable, more control, and production-ready.
 * 
 * Prerequisites:
 * - Tables must exist (run `pnpm db:migrate` first)
 * - Application must set user context before queries
 * 
 * Usage:
 *   psql $DATABASE_DEV_URL -f drizzle/migrations-manual/001_enable_rls_standard.sql
 * 
 * How It Works:
 * 1. Application verifies WorkOS JWT
 * 2. Application sets session variables: SET LOCAL app.user_id = 'user_xxx'
 * 3. RLS policies read: current_setting('app.user_id')
 * 4. Database enforces isolation automatically
 */

-- ============================================================================
-- CREATE APP SCHEMA (for helper functions)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user ID from session variable
CREATE OR REPLACE FUNCTION app.current_user_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.user_id', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current organization ID from session variable
CREATE OR REPLACE FUNCTION app.current_org_id() 
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.org_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION app.is_org_member(check_org_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE org_id = check_org_id
    AND workos_user_id = app.current_user_id()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user has specific role in organization
CREATE OR REPLACE FUNCTION app.has_org_role(check_org_id UUID, required_role TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE org_id = check_org_id
    AND workos_user_id = app.current_user_id()
    AND role = required_role
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

-- Read: Users can see organizations they belong to
CREATE POLICY organizations_read ON organizations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = organizations.id
    AND user_org_memberships.workos_user_id = app.current_user_id()
    AND user_org_memberships.status = 'active'
  )
);

-- Update: Only owners and admins can update organizations
CREATE POLICY organizations_update ON organizations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = organizations.id
    AND user_org_memberships.workos_user_id = app.current_user_id()
    AND user_org_memberships.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- USERS (Minimal policies - most data from WorkOS)
-- ============================================================================

-- Users can read their own record
CREATE POLICY users_read ON users
FOR SELECT USING (workos_user_id = app.current_user_id());

-- Users can update their own record
CREATE POLICY users_update ON users
FOR UPDATE USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- USER-ORG MEMBERSHIPS
-- ============================================================================

-- Users can only see their own memberships
CREATE POLICY memberships_read ON user_org_memberships
FOR SELECT USING (workos_user_id = app.current_user_id());

-- No INSERT/UPDATE/DELETE policies - managed via WorkOS webhooks only

-- ============================================================================
-- EVENTS
-- ============================================================================

-- Read: Users can access events from orgs they belong to
CREATE POLICY events_read ON events
FOR SELECT USING (app.is_org_member(org_id));

-- Insert/Update/Delete: Only event owner
CREATE POLICY events_modify ON events
FOR ALL USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- SCHEDULES
-- ============================================================================

-- Read: Users can access schedules from their orgs
CREATE POLICY schedules_read ON schedules
FOR SELECT USING (app.is_org_member(org_id));

-- Modify: Only schedule owner
CREATE POLICY schedules_modify ON schedules
FOR ALL USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- SCHEDULE AVAILABILITIES
-- ============================================================================

-- Inherits permissions from schedules table
-- Users can access if they can access the parent schedule
CREATE POLICY schedule_availabilities_all ON schedule_availabilities
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM schedules
    WHERE schedules.id = schedule_availabilities.schedule_id
    AND schedules.workos_user_id = app.current_user_id()
  )
);

-- ============================================================================
-- MEETINGS
-- ============================================================================

-- Read: Users can access meetings from their orgs
CREATE POLICY meetings_read ON meetings
FOR SELECT USING (app.is_org_member(org_id));

-- Modify: Only meeting organizer (expert)
CREATE POLICY meetings_modify ON meetings
FOR ALL USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- CATEGORIES (Public - No RLS needed but enable for consistency)
-- ============================================================================

-- Public read access
CREATE POLICY categories_read ON categories
FOR SELECT USING (true);

-- Only admins can modify (check via app logic, not RLS)
-- For now, allow all authenticated users
CREATE POLICY categories_modify ON categories
FOR ALL USING (app.current_user_id() IS NOT NULL);

-- ============================================================================
-- PROFILES (Public read, owner write)
-- ============================================================================

-- Public read access (expert profiles are public)
CREATE POLICY profiles_read ON profiles
FOR SELECT USING (true);

-- Only profile owner can modify
CREATE POLICY profiles_modify ON profiles
FOR ALL USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- RECORDS (PHI - Strict org-scoped access)
-- ============================================================================

-- Read: Users from same org
CREATE POLICY records_read ON records
FOR SELECT USING (app.is_org_member(org_id));

-- Modify: Only the expert who created it
CREATE POLICY records_modify ON records
FOR ALL USING (expert_id = app.current_user_id());

-- ============================================================================
-- PAYMENT TRANSFERS
-- ============================================================================

-- Read: Users from same org (to see their payment history)
CREATE POLICY payment_transfers_read ON payment_transfers
FOR SELECT USING (app.is_org_member(org_id));

-- Modify: System only (handled via admin context in app)
-- For now, restrict to expert
CREATE POLICY payment_transfers_modify ON payment_transfers
FOR ALL USING (expert_workos_user_id = app.current_user_id());

-- ============================================================================
-- SCHEDULING SETTINGS
-- ============================================================================

-- Read/Write: Only the user's own settings
CREATE POLICY scheduling_settings_all ON scheduling_settings
FOR ALL USING (workos_user_id = app.current_user_id());

-- ============================================================================
-- AUDIT LOGS (Org-scoped read, append-only)
-- ============================================================================

-- Read: Users can see audit logs from their org
CREATE POLICY audit_logs_read ON audit_logs
FOR SELECT USING (app.is_org_member(org_id));

-- Insert: Any authenticated user can create audit logs
CREATE POLICY audit_logs_insert ON audit_logs
FOR INSERT WITH CHECK (app.current_user_id() IS NOT NULL);

-- No UPDATE or DELETE policies (append-only for HIPAA compliance)

-- ============================================================================
-- AUDIT LOG EXPORTS (Admin only)
-- ============================================================================

-- Read: Only org owners and admins
CREATE POLICY audit_exports_read ON audit_log_exports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = audit_log_exports.org_id
    AND user_org_memberships.workos_user_id = app.current_user_id()
    AND user_org_memberships.status = 'active'
    AND user_org_memberships.role IN ('owner', 'admin')
  )
);

-- Insert: Only org owners and admins
CREATE POLICY audit_exports_insert ON audit_log_exports
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = audit_log_exports.org_id
    AND user_org_memberships.workos_user_id = app.current_user_id()
    AND user_org_memberships.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- AUDIT STATS (Read-only, org-scoped)
-- ============================================================================

-- Read: Users can see stats from their org
CREATE POLICY audit_stats_read ON audit_stats
FOR SELECT USING (app.is_org_member(org_id));

-- No write policies - stats generated by system

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check that policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test helper functions
SELECT 
  'app.current_user_id()' as function,
  app.current_user_id() as result;

SELECT 
  'app.current_org_id()' as function,
  app.current_org_id() as result;

-- ============================================================================
-- NOTES
-- ============================================================================

/*
 * How to Use This in Your Application:
 * 
 * 1. After authenticating user with WorkOS:
 *    const userId = session.user.id;
 *    const orgId = session.organizationId;
 * 
 * 2. Before running queries, set context:
 *    await db.execute(sql`SET LOCAL app.user_id = ${userId}`);
 *    await db.execute(sql`SET LOCAL app.org_id = ${orgId}`);
 * 
 * 3. Run your queries normally:
 *    const events = await db.select().from(EventsTable);
 *    // RLS automatically filters to user's org
 * 
 * 4. Context automatically clears after transaction
 * 
 * Benefits of This Approach:
 * - ✅ Production-ready (used by Stripe, GitHub, etc.)
 * - ✅ Portable (works with any Postgres)
 * - ✅ Full control over authentication
 * - ✅ Easy to debug and test
 * - ✅ No dependency on Neon-specific features
 * 
 * Performance Notes:
 * - SET LOCAL is very fast (per-transaction)
 * - Helper functions are STABLE (cached per query)
 * - EXISTS checks use indexes efficiently
 * - Connection pooling works normally
 */

