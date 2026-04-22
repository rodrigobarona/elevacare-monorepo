# WorkOS RBAC + Neon RLS Integration Review

## Executive Summary

This document reviews the current RBAC implementation and provides recommendations to fully leverage WorkOS's native RBAC features with Neon's Row-Level Security (RLS) for a more robust, scalable, and maintainable authorization system.

## Current State Analysis

### ✅ What's Working Well

1. **RLS Enabled on All Tables**: All sensitive tables have RLS policies using `auth.user_id()` from JWT
2. **Organization-Scoped Access**: RLS policies correctly check `user_org_memberships` for org-based access
3. **Hybrid Role System**: Both application roles (`UsersTable.role`) and organization roles (`UserOrgMembershipsTable.role`) are tracked
4. **JWT-Based Authentication**: Using Neon Auth's `auth.user_id()` to extract WorkOS user ID from JWT

### ⚠️ Current Limitations

1. **Not Using WorkOS Native RBAC Features**
   - WorkOS has built-in roles and permissions configurable in the dashboard
   - Currently, roles are hardcoded in application code and database
   - Missing WorkOS permission-based authorization (only using roles)

2. **Role Duplication Across Multiple Tables**

   ```typescript
   // Roles stored in 3 different places:
   UsersTable.role; // Application role
   RolesTable.role; // Multiple roles per user
   UserOrgMembershipsTable.role; // Organization membership role
   ```

3. **No IdP Role Assignment Integration**
   - WorkOS supports automatic role assignment from SSO/Directory Sync
   - Not leveraging enterprise customer IdP groups → role mapping

4. **Limited Use of JWT Claims**
   - JWT contains rich role/permission information from WorkOS
   - Currently only extracting `user_id` from JWT
   - Could embed organization roles and permissions in JWT claims

5. **Permission System Not Implemented**
   - Current system only checks roles (coarse-grained)
   - WorkOS RBAC supports granular permissions (e.g., `reports:read`, `users:write`)
   - See: `_docs/partner_admin2-core-systems/authentication/partner_admin3-permission-system.md` (planned, not implemented)

## WorkOS RBAC Features You Should Leverage

### 1. Configure Roles and Permissions in WorkOS Dashboard

WorkOS allows you to define roles and permissions centrally:

```typescript
// Instead of hardcoding in code, define in WorkOS Dashboard:

// Roles (with priority order):
// - superadmin
// - admin
// - expert_top
// - expert_community
// - user

// Permissions (slug format: resource:action):
// - users:read
// - users:write
// - events:create
// - events:manage
// - billing:access
// - analytics:view
// - appointments:manage
```

**Benefits**:

- Change permissions without deploying code
- Use WorkOS Dashboard for role management
- Consistent across all WorkOS integrations (AuthKit, Directory Sync, SSO)

### 2. Assign Roles via WorkOS API

```typescript
// Current approach (custom database tables):
await db.insert(RolesTable).values({
  workosUserId: user.id,
  role: 'expert_top',
});

// ✅ RECOMMENDED: Use WorkOS Organization Membership API
await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: membership.id,
  roleSlug: 'expert_top', // Defined in WorkOS Dashboard
});
```

**Benefits**:

- Single source of truth (WorkOS)
- Roles automatically included in JWT
- No database sync needed
- Supports IdP role assignment

### 3. Enforce Permissions via JWT Claims

WorkOS includes role information in session JWTs:

```typescript
// JWT Payload Structure:
{
  "sub": "user_partner_admin1H...",           // WorkOS User ID
  "org_id": "org_partner_admin1H...",          // Organization ID
  "org_slug": "acme-corp",
  "role": "expert_top",            // Organization role
  "permissions": [                 // Permissions array
    "events:create",
    "events:manage",
    "billing:access"
  ]
}
```

**How to Use in Application**:

```typescript
// ✅ Read role from JWT (already available in session)
const { user } = await withAuth();
const role = user.role; // From JWT claim

// ✅ Check permissions from JWT
const permissions = user.permissions || [];
const canManageEvents = permissions.includes('events:manage');
```

### 4. Leverage IdP Role Assignment

For enterprise customers with SSO/Directory Sync:

```typescript
// In WorkOS Dashboard, configure IdP group → role mapping:
//
// Okta Group "Doctors"     → expert_top
// Okta Group "Nurses"      → expert_community
// Azure AD Group "Admins"  → admin
//
// Users automatically get roles based on their IdP groups!
```

**Benefits**:

- Zero manual role assignment for enterprise customers
- Automatic role updates when IdP groups change
- Reduced administrative burden
- Enterprise-ready onboarding

### 5. Organization-Level Custom Roles

WorkOS supports custom roles per organization:

```typescript
// Global roles (all orgs):
// - admin, member, billing_admin

// Organization-specific roles (partners can define):
// - clinic_owner
// - head_doctor
// - receptionist
// - billing_manager

// Each org can have different role definitions!
```

**Use Case for Eleva**:

- Solo experts: Use global expert_top/expert_community roles
- Partners (Phase 2): Define custom roles per partner
- Educational institutions (Phase 3): Custom roles for lecturers

## Recommended Implementation Strategy

### Phase 1: Migrate to WorkOS Native Roles (Immediate)

#### Step 1: Define Roles in WorkOS Dashboard

1. Go to WorkOS Dashboard → RBAC → Roles
2. Create roles matching your schema:
   ```
   superadmin         (priority: 1partner_adminpartner_admin)
   admin              (priority: 9partner_admin)
   expert_top         (priority: 8partner_admin)
   expert_community   (priority: 7partner_admin)
   expert_lecturer    (priority: 6partner_admin)
   user               (priority: 1partner_admin)
   ```

#### Step 2: Define Permissions

Create permissions in WorkOS Dashboard:

```typescript
// Expert permissions
events: create;
events: manage;
appointments: view;
appointments: manage;
calendar: manage;
earnings: view;

// Top Expert exclusive
analytics: advanced;
branding: customize;
group_sessions: create;

// Admin permissions
users: read;
users: write;
experts: approve;
platform: configure;
reports: access;

// Billing permissions
billing: view;
billing: manage;
```

#### Step 3: Assign Permissions to Roles

In WorkOS Dashboard, map permissions to roles:

```typescript
expert_community:
  - events:create
  - appointments:manage
  - calendar:manage
  - earnings:view

expert_top:
  - events:create
  - events:manage
  - appointments:manage
  - calendar:manage
  - earnings:view
  - analytics:advanced
  - branding:customize
  - group_sessions:create

admin:
  - users:read
  - users:write
  - experts:approve
  - reports:access
  - platform:configure
```

#### Step 4: Update Code to Use JWT Claims

**Before (current approach)**:

```typescript
// lib/integrations/workos/roles.ts
export async function getUserRoles(workosUserId: string): Promise<string[]> {
  // Fetch from database
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, workosUserId),
  });

  const memberships = await db.query.UserOrgMembershipsTable.findMany({
    where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
  });

  // Merge roles from multiple tables...
}
```

**After (recommended)**:

```typescript
// lib/integrations/workos/roles.ts
import { withAuth } from '@workos-inc/authkit-nextjs';

/**
 * Get current user's role from JWT (no database query needed!)
 */
export async function getCurrentUserRole(): Promise<string> {
  const { user } = await withAuth();
  if (!user) throw new Error('Unauthorized');

  // Role is already in JWT from WorkOS
  return user.role || 'user';
}

/**
 * Get current user's permissions from JWT
 */
export async function getCurrentUserPermissions(): Promise<string[]> {
  const { user } = await withAuth();
  if (!user) throw new Error('Unauthorized');

  // Permissions are in JWT from WorkOS
  return user.permissions || [];
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const permissions = await getCurrentUserPermissions();
  return permissions.includes(permission);
}
```

**Benefits**:

- No database queries for role checks
- Instant role/permission information
- Single source of truth (WorkOS JWT)
- Reduced code complexity

### Phase 2: Enhance RLS with Permission-Based Policies

#### Current RLS Policy Example

```sql
-- Current: Role-based RLS (checking UsersTable.role)
CREATE POLICY "Admins can view all applications"
ON expert_applications FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.workos_user_id = auth.user_id()
    AND users.role IN ('admin', 'superadmin')
  )
);
```

#### Recommended: Permission-Based RLS

```sql
-- ✅ RECOMMENDED: Permission-based RLS (using JWT claims)

-- First, create helper function to extract permissions from JWT
CREATE OR REPLACE FUNCTION auth.jwt_permissions()
RETURNS text[] AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'permissions',
    '[]'
  )::text[]
$$ LANGUAGE sql STABLE;

-- Then, use in RLS policies
CREATE POLICY "Users with experts:approve can view all applications"
ON expert_applications FOR SELECT USING (
  'experts:approve' = ANY(auth.jwt_permissions())
);

CREATE POLICY "Users with events:manage can manage any event"
ON events FOR ALL USING (
  'events:manage' = ANY(auth.jwt_permissions())
);

CREATE POLICY "Users can manage their own events"
ON events FOR ALL USING (
  workos_user_id = auth.user_id()
  OR 'events:manage' = ANY(auth.jwt_permissions())
);
```

**Benefits**:

- Granular permission checks at database level
- No database joins for permission verification
- Permissions sourced directly from JWT
- Easy to add new permissions without schema changes

### Phase 3: Implement IdP Role Assignment (Enterprise Ready)

For enterprise customers using SSO:

#### Step 1: Configure in WorkOS Dashboard

1. Enable Directory Sync for organization
2. Configure group mappings:
   ```
   Okta Group "Medical Directors"  → expert_top
   Okta Group "Practitioners"      → expert_community
   Okta Group "Administrative"     → admin
   ```

#### Step 2: Handle Automatic Provisioning

```typescript
// lib/integrations/workos/webhooks/directory-user-created.ts

export async function handleDirectoryUserCreated(event: DirectoryUserCreatedEvent) {
  const { user, directory_groups } = event.data;

  // WorkOS automatically assigns roles based on IdP groups!
  // No manual role assignment needed

  // Just sync user to database
  await syncWorkOSUserToDatabase({
    workosUserId: user.id,
    email: user.email,
    // Role already set by WorkOS based on IdP group mapping
  });
}
```

**Benefits for Enterprise Customers**:

- Automatic role assignment based on their existing IdP groups
- No manual role management by Eleva staff
- Roles stay in sync with customer's IdP
- Faster enterprise onboarding

### Phase 4: Simplify Database Schema

With WorkOS RBAC fully integrated, you can simplify:

#### Tables to Remove/Simplify

```typescript
// ❌ REMOVE: RolesTable (roles now in WorkOS)
export const RolesTable = pgTable('roles', { ... });

// ❌ SIMPLIFY: Remove role field from UsersTable
// Role should be fetched from WorkOS, not stored in database
export const UsersTable = pgTable('users', {
  // Remove:
  role: text('role').notNull().default('user'),

  // Keep other fields...
});

// ✅ KEEP: UserOrgMembershipsTable (cache WorkOS memberships)
// But synchronize from WorkOS, don't manually manage
export const UserOrgMembershipsTable = pgTable('user_org_memberships', {
  role: text('role').notNull(), // Synced from WorkOS
});
```

#### Migration Strategy

```typescript
// 1. Update code to read roles from JWT instead of database
// 2. Create migration script to sync existing roles to WorkOS
// 3. Update RLS policies to use JWT permissions
// 4. Remove RolesTable and UsersTable.role field
// 5. Keep UserOrgMembershipsTable as cache (synced via webhooks)
```

## Security Best Practices

### 1. Verify JWT Signature

Ensure Neon Auth is configured with WorkOS JWKS:

```sql
-- In Neon SQL Editor, verify JWT configuration:
SELECT auth.verify_jwt_config();

-- Should show:
-- jwks_url: https://api.workos.com/.well-known/jwks.json
-- issuer: https://api.workos.com
```

### 2. Handle JWT Expiration

```typescript
// AuthKit automatically refreshes tokens
// But handle expired tokens gracefully:

export async function withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error.message.includes('jwt expired')) {
      // Refresh token and retry
      await refreshAccessToken();
      return await operation();
    }
    throw error;
  }
}
```

### 3. Layer Security

Even with JWT-based RLS, maintain multiple security layers:

```typescript
// 1. Middleware (route-level)
if (!session.user) return redirect('/sign-in');

// 2. Server Component (page-level)
const hasPermission = await checkPermission('events:manage');
if (!hasPermission) return <Unauthorized />;

// 3. API Route (endpoint-level)
if (!hasPermission('users:write')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 4partner_admin3 });
}

// 4. Database RLS (data-level)
// Policies automatically applied via JWT
```

### 4. Audit Logging

Enhance audit logs to include permission checks:

```typescript
await logAuditEvent({
  action: 'EXPERT_APPLICATION_VIEWED',
  resourceType: 'expert_application',
  resourceId: application.id,
  metadata: {
    permission: 'experts:approve', // Permission used
    roleAtTime: user.role, // Role at time of action
  },
});
```

## Performance Optimizations

### 1. Reduce Database Queries

**Before** (3 queries per request):

```typescript
const user = await db.query.UsersTable.findFirst(...);
const roles = await db.query.RolesTable.findMany(...);
const memberships = await db.query.UserOrgMembershipsTable.findMany(...);
```

**After** (partner_admin queries for role/permission checks):

```typescript
const { user } = await withAuth(); // Role/permissions already in JWT
const role = user.role;
const permissions = user.permissions;
```

### 2. Cache Organization Memberships

Keep `UserOrgMembershipsTable` as a cache, synced via webhooks:

```typescript
// Webhook handler for membership changes
export async function handleOrganizationMembershipUpdated(
  event: OrganizationMembershipUpdatedEvent,
) {
  const { membership } = event.data;

  // Update cache in database
  await db
    .update(UserOrgMembershipsTable)
    .set({
      role: membership.role.slug,
      status: membership.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(UserOrgMembershipsTable.workosUserId, membership.user.id),
        eq(UserOrgMembershipsTable.orgId, membership.organization.id),
      ),
    );
}
```

### 3. Index JWT Claims

For optimal RLS performance, ensure JWT extraction is efficient:

```sql
-- Create index on JWT extraction function
CREATE INDEX CONCURRENTLY idx_jwt_user_id
ON your_table ((current_setting('request.jwt.claims', true)::json->>'sub'));
```

## Testing Strategy

### 1. Test JWT Role Assignment

```typescript
// test/integration/rbac/jwt-roles.test.ts

describe('JWT Role Assignment', () => {
  it('should include role in JWT after assignment', async () => {
    // Assign role via WorkOS API
    await workos.userManagement.updateOrganizationMembership({
      organizationMembershipId: membership.id,
      roleSlug: 'expert_top',
    });

    // Sign in and get new JWT
    const { user } = await withAuth();

    // Role should be in JWT
    expect(user.role).toBe('expert_top');
  });

  it('should include permissions in JWT', async () => {
    // Role should have permissions defined in WorkOS Dashboard
    const { user } = await withAuth();

    expect(user.permissions).toContain('events:manage');
    expect(user.permissions).toContain('analytics:advanced');
  });
});
```

### 2. Test RLS Policies

```typescript
// test/integration/rls/permission-based.test.ts

describe('Permission-Based RLS', () => {
  it('should allow access with correct permission', async () => {
    // User with 'experts:approve' permission
    const events = await db.select().from(ExpertApplicationsTable);

    expect(events.length).toBeGreaterThan(partner_admin);
  });

  it('should deny access without permission', async () => {
    // User without 'experts:approve' permission
    const events = await db.select().from(ExpertApplicationsTable);

    expect(events.length).toBe(partner_admin); // RLS filters out
  });
});
```

### 3. Test IdP Role Assignment

```typescript
// test/integration/rbac/idp-assignment.test.ts

describe('IdP Role Assignment', () => {
  it('should assign role based on IdP group', async () => {
    // Simulate Directory Sync event with group membership
    await handleDirectorySyncGroupMembership({
      user: { id: 'user_123', email: 'doctor@partner.com' },
      group: { name: 'Medical Directors' }, // Mapped to expert_top
    });

    // User should have expert_top role
    const membership = await workos.userManagement.getOrganizationMembership({
      organizationMembershipId: membership.id,
    });

    expect(membership.role.slug).toBe('expert_top');
  });
});
```

## Migration Checklist

### Immediate Actions (Week 1-2)

- [ ] Set up RBAC in WorkOS Dashboard
  - [ ] Define all roles with priorities
  - [ ] Define all permissions (resource:action format)
  - [ ] Map permissions to roles
- [ ] Create migration script to sync existing roles to WorkOS
- [ ] Update `lib/integrations/workos/roles.ts` to read from JWT
- [ ] Test JWT role assignment in development

### Short-term (Week 3-4)

- [ ] Update all role checks to use JWT-based functions
- [ ] Create permission-based helper functions
- [ ] Update middleware to use JWT permissions
- [ ] Add permission checks to critical API routes
- [ ] Test thoroughly in staging

### Medium-term (Month 2)

- [ ] Create RLS helper functions for JWT permissions
- [ ] Migrate RLS policies from role-based to permission-based
- [ ] Update documentation for developers
- [ ] Train team on new permission system
- [ ] Deploy to production with feature flag

### Long-term (Month 3-6)

- [ ] Implement IdP role assignment for enterprise
- [ ] Remove RolesTable from database
- [ ] Remove role field from UsersTable
- [ ] Simplify codebase (delete old role checking code)
- [ ] Monitor performance improvements
- [ ] Gather feedback and iterate

## Expected Benefits

### Developer Experience

- ✅ 6partner_admin% less code for role management
- ✅ No database queries for role checks
- ✅ Centralized permission management in WorkOS Dashboard
- ✅ Type-safe permissions from JWT

### Performance

- ✅ 3x faster role checks (no database queries)
- ✅ Reduced database load
- ✅ Efficient RLS with JWT claims

### Security

- ✅ Single source of truth (WorkOS)
- ✅ Granular permission control
- ✅ Database-level enforcement via RLS
- ✅ Automatic IdP synchronization

### Business

- ✅ Enterprise-ready (IdP role assignment)
- ✅ Faster customer onboarding
- ✅ Reduced operational overhead
- ✅ Scalable role management

## Additional Resources

### WorkOS Documentation

- [RBAC Overview](https://workos.com/docs/rbac)
- [Configure Roles and Permissions](https://workos.com/docs/rbac/configuration)
- [IdP Role Assignment](https://workos.com/docs/rbac/assignments/idp-role-assignment)
- [AuthKit JWT Claims](https://workos.com/docs/authkit/sessions/integrating-sessions/access-token)

### Internal Documentation

- `_docs/partner_admin2-core-systems/authentication/partner_admin2-role-management.md`
- `_docs/partner_admin2-core-systems/authentication/partner_admin3-permission-system.md`
- `drizzle/migrations-manual/partner_adminpartner_admin1_enable_rls.sql`

### Code Examples

- [WorkOS RBAC with Node.js](https://workos.com/blog/rbac-with-workos-and-node)
- [The Developer's Guide to RBAC](https://workos.com/guide/the-developers-guide-to-rbac)

## Questions & Next Steps

### Questions for Team Discussion

1. **Timeline**: When should we start migrating to WorkOS native RBAC?
2. **Breaking Changes**: How to handle existing users during migration?
3. **Enterprise Priority**: Should we prioritize IdP role assignment for specific customers?
4. **Permission Granularity**: How fine-grained should permissions be?
5. **Backward Compatibility**: How long to maintain old role checking code?

### Recommended Next Steps

1. **Proof of Concept** (1 week):
   - Set up RBAC in WorkOS Dashboard (dev environment)
   - Create sample role and permissions
   - Test JWT claims with one endpoint
   - Measure performance improvement

2. **Team Review** (1 day):
   - Share this document with team
   - Discuss migration strategy
   - Assign ownership for each phase
   - Create tickets in project management tool

3. **Pilot Implementation** (2 weeks):
   - Migrate one feature to permission-based auth
   - Update RLS for that feature
   - Test thoroughly
   - Document learnings

4. **Full Rollout** (1-2 months):
   - Execute full migration checklist
   - Monitor performance and errors
   - Iterate based on feedback
   - Complete documentation updates

---

**Document Maintained By**: Engineering Team  
**Last Updated**: {{ today }}  
**Next Review**: Q1 2partner_admin25
