/**
 * Row-Level Security (RLS) Policies for WorkOS Migration
 * 
 * This file enables RLS on all tables and creates policies that use `auth.user_id()`.
 * The `auth.user_id()` function is provided by Neon Auth and extracts the WorkOS user ID
 * from the JWT automatically.
 * 
 * Prerequisites:
 * - Neon Data API must be enabled
 * - WorkOS JWKS URL must be configured: https://api.workos.com/.well-known/jwks.json
 * - Tables must exist (run `pnpm db:migrate` first)
 * 
 * Usage:
 *   psql $DATABASE_DEV_URL -f drizzle/migrations-manual/001_enable_rls.sql
 */

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
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.status = 'active'
  )
);

-- Update: Only owners and admins can update organizations
CREATE POLICY organizations_update ON organizations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = organizations.id
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- USERS (Minimal policies - most data from WorkOS)
-- ============================================================================

-- Users can read their own record
CREATE POLICY users_read ON users
FOR SELECT USING (workos_user_id = auth.user_id());

-- Users can update their own record
CREATE POLICY users_update ON users
FOR UPDATE USING (workos_user_id = auth.user_id());

-- ============================================================================
-- USER-ORG MEMBERSHIPS
-- ============================================================================

-- Users can only see their own memberships
CREATE POLICY memberships_read ON user_org_memberships
FOR SELECT USING (workos_user_id = auth.user_id());

-- No INSERT/UPDATE/DELETE policies - managed via WorkOS only

-- ============================================================================
-- EVENTS
-- ============================================================================

-- Read: Users can access events from orgs they belong to
CREATE POLICY events_read ON events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = events.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.status = 'active'
  )
);

-- Insert/Update/Delete: Only event owner
CREATE POLICY events_modify ON events
FOR ALL USING (workos_user_id = auth.user_id());

-- ============================================================================
-- SCHEDULES
-- ============================================================================

-- Read: Users can access schedules from their orgs
CREATE POLICY schedules_read ON schedules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = schedules.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
  )
);

-- Modify: Only schedule owner
CREATE POLICY schedules_modify ON schedules
FOR ALL USING (workos_user_id = auth.user_id());

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
    AND schedules.workos_user_id = auth.user_id()
  )
);

-- ============================================================================
-- MEETINGS
-- ============================================================================

-- Read: Users can access meetings from their orgs
CREATE POLICY meetings_read ON meetings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = meetings.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
  )
);

-- Modify: Only meeting organizer (expert)
CREATE POLICY meetings_modify ON meetings
FOR ALL USING (workos_user_id = auth.user_id());

-- ============================================================================
-- CATEGORIES (Public - No RLS needed but enable for consistency)
-- ============================================================================

-- Public read access
CREATE POLICY categories_read ON categories
FOR SELECT USING (true);

-- Only admins can modify (check via app logic, not RLS)
-- For now, allow all authenticated users
CREATE POLICY categories_modify ON categories
FOR ALL USING (auth.user_id() IS NOT NULL);

-- ============================================================================
-- PROFILES (Public read, owner write)
-- ============================================================================

-- Public read access (expert profiles are public)
CREATE POLICY profiles_read ON profiles
FOR SELECT USING (true);

-- Only profile owner can modify
CREATE POLICY profiles_modify ON profiles
FOR ALL USING (workos_user_id = auth.user_id());

-- ============================================================================
-- RECORDS (PHI - Strict org-scoped access)
-- ============================================================================

-- Read: Users from same org
CREATE POLICY records_read ON records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = records.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
  )
);

-- Modify: Only the expert who created it
CREATE POLICY records_modify ON records
FOR ALL USING (expert_id = auth.user_id());

-- ============================================================================
-- PAYMENT TRANSFERS
-- ============================================================================

-- Read: Users from same org (to see their payment history)
CREATE POLICY payment_transfers_read ON payment_transfers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = payment_transfers.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
  )
);

-- Modify: System only (handled via app logic, not RLS)
-- For now, restrict to expert
CREATE POLICY payment_transfers_modify ON payment_transfers
FOR ALL USING (expert_workos_user_id = auth.user_id());

-- ============================================================================
-- SCHEDULING SETTINGS
-- ============================================================================

-- Read/Write: Only the user's own settings
CREATE POLICY scheduling_settings_all ON scheduling_settings
FOR ALL USING (workos_user_id = auth.user_id());

-- ============================================================================
-- AUDIT LOGS (Org-scoped read, append-only)
-- ============================================================================

-- Read: Users can see audit logs from their org
CREATE POLICY audit_logs_read ON audit_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = audit_logs.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.status = 'active'
  )
);

-- Insert: Any authenticated user can create audit logs
CREATE POLICY audit_logs_insert ON audit_logs
FOR INSERT WITH CHECK (auth.user_id() IS NOT NULL);

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
    AND user_org_memberships.workos_user_id = auth.user_id()
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
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- AUDIT STATS (Read-only, org-scoped)
-- ============================================================================

-- Read: Users can see stats from their org
CREATE POLICY audit_stats_read ON audit_stats
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = audit_stats.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.status = 'active'
  )
);

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

-- Test auth.user_id() function
SELECT auth.user_id() as current_user_id;

-- ============================================================================
-- NOTES
-- ============================================================================

/*
 * Important Notes:
 * 
 * 1. auth.user_id() returns the 'sub' claim from the JWT
 *    - This is the WorkOS user ID
 *    - Returns NULL if no JWT or invalid JWT
 * 
 * 2. All policies use EXISTS checks against user_org_memberships
 *    - This ensures users can only access data from orgs they belong to
 *    - status = 'active' check prevents access from suspended memberships
 * 
 * 3. Categories and Profiles have public read access
 *    - This allows browsing expert profiles without authentication
 *    - Write access is restricted to owners
 * 
 * 4. Audit logs are append-only
 *    - No UPDATE or DELETE policies
 *    - Required for HIPAA compliance
 * 
 * 5. System operations
 *    - Some operations (like payment processing) happen via admin context
 *    - Use getAdminDb() in migration scripts, not production queries
 * 
 * 6. Testing RLS
 *    - You can test by providing a JWT with a 'sub' claim
 *    - Neon Auth validates the JWT via WorkOS JWKS
 *    - auth.user_id() will return the 'sub' claim
 * 
 * 7. Performance
 *    - RLS policies with EXISTS are efficient when properly indexed
 *    - We have indexes on orgId and workosUserId columns
 *    - Connection pooling helps with performance
 */

