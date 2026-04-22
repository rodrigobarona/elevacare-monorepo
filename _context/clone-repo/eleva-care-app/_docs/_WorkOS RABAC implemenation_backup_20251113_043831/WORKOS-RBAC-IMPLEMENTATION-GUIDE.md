# WorkOS RBAC Implementation Guide

## Quick Start: Migrating from Custom Roles to WorkOS RBAC

This guide provides step-by-step instructions and code examples for migrating from your current custom role system to WorkOS native RBAC with Neon RLS.

## Step 1: Configure Roles in WorkOS Dashboard

### 1.1 Access WorkOS Dashboard

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Navigate to **RBAC** → **Roles**
3. Click **Create Role**

### 1.2 Create Application Roles

Create these roles in order (priority determines hierarchy):

```typescript
// Roles Configuration

Superadmin
  - Slug: superadmin
  - Name: Super Administrator
  - Description: Full system access with ability to assign any role
  - Priority: 100

Admin
  - Slug: admin
  - Name: Administrator
  - Description: Administrative access to manage users, experts, and content
  - Priority: 90

Expert Top
  - Slug: expert_top
  - Name: Top Expert
  - Description: Premium expert with advanced features
  - Priority: 80

Expert Community
  - Slug: expert_community
  - Name: Community Expert
  - Description: Standard expert account
  - Priority: 70

Expert Lecturer
  - Slug: expert_lecturer
  - Name: Lecturer
  - Description: Educational content creator
  - Priority: 60

User
  - Slug: user
  - Name: User (Patient)
  - Description: Basic user/patient account
  - Priority: 10
```

### 1.3 Create Permissions

Navigate to **RBAC** → **Permissions** and create:

```typescript
// Expert Permissions
events:create
  - Description: Create new event types
  - Category: Events

events:manage
  - Description: Full event management including deletion
  - Category: Events

appointments:view
  - Description: View appointment bookings
  - Category: Appointments

appointments:manage
  - Description: Manage appointments (reschedule, cancel)
  - Category: Appointments

calendar:manage
  - Description: Manage availability calendar
  - Category: Calendar

earnings:view
  - Description: View earnings and payment history
  - Category: Billing

// Top Expert Exclusive Permissions
analytics:advanced
  - Description: Access advanced analytics dashboard
  - Category: Analytics

branding:customize
  - Description: Customize profile branding
  - Category: Profile

group_sessions:create
  - Description: Create group session events
  - Category: Events

messaging:direct
  - Description: Direct messaging with patients
  - Category: Communication

// Admin Permissions
users:read
  - Description: View user information
  - Category: User Management

users:write
  - Description: Edit user information
  - Category: User Management

experts:approve
  - Description: Approve expert applications
  - Category: Expert Management

platform:configure
  - Description: Configure platform settings
  - Category: Administration

reports:access
  - Description: Access admin reports
  - Category: Reports

// Billing Permissions
billing:view
  - Description: View billing information
  - Category: Billing

billing:manage
  - Description: Manage billing and subscriptions
  - Category: Billing
```

### 1.4 Assign Permissions to Roles

In WorkOS Dashboard, for each role, assign permissions:

```typescript
// User (patient) - basic permissions
- appointments:view (their own only, enforced by RLS)
- billing:view (their own only, enforced by RLS)

// Expert Community
- events:create
- appointments:view
- appointments:manage
- calendar:manage
- earnings:view
- billing:view

// Expert Top (inherits Expert Community + adds)
- events:manage
- analytics:advanced
- branding:customize
- group_sessions:create
- messaging:direct
- billing:manage

// Expert Lecturer
- events:create
- appointments:view
- calendar:manage
- earnings:view

// Admin
- users:read
- users:write
- experts:approve
- platform:configure
- reports:access
- billing:view

// Superadmin
- All permissions
```

## Step 2: Update TypeScript Types

Create new types for WorkOS RBAC:

```typescript
// types/workos-rbac.ts

/**
 * WorkOS RBAC Role Slugs
 *
 * These match the roles defined in WorkOS Dashboard
 */
export const WORKOS_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  EXPERT_TOP: 'expert_top',
  EXPERT_COMMUNITY: 'expert_community',
  EXPERT_LECTURER: 'expert_lecturer',
  USER: 'user',
} as const;

export type WorkOSRole = (typeof WORKOS_ROLES)[keyof typeof WORKOS_ROLES];

/**
 * WorkOS RBAC Permission Slugs
 *
 * These match the permissions defined in WorkOS Dashboard
 */
export const WORKOS_PERMISSIONS = {
  // Events
  EVENTS_CREATE: 'events:create',
  EVENTS_MANAGE: 'events:manage',

  // Appointments
  APPOINTMENTS_VIEW: 'appointments:view',
  APPOINTMENTS_MANAGE: 'appointments:manage',

  // Calendar
  CALENDAR_MANAGE: 'calendar:manage',

  // Earnings & Billing
  EARNINGS_VIEW: 'earnings:view',
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  // Analytics
  ANALYTICS_ADVANCED: 'analytics:advanced',

  // Profile
  BRANDING_CUSTOMIZE: 'branding:customize',

  // Group Sessions
  GROUP_SESSIONS_CREATE: 'group_sessions:create',

  // Messaging
  MESSAGING_DIRECT: 'messaging:direct',

  // Admin
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  EXPERTS_APPROVE: 'experts:approve',
  PLATFORM_CONFIGURE: 'platform:configure',
  REPORTS_ACCESS: 'reports:access',
} as const;

export type WorkOSPermission = (typeof WORKOS_PERMISSIONS)[keyof typeof WORKOS_PERMISSIONS];

/**
 * Extended AuthKit User with RBAC claims
 */
export interface WorkOSUserWithRBAC {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;

  // RBAC claims from JWT
  role?: WorkOSRole;
  permissions?: WorkOSPermission[];

  // Organization context
  organizationId?: string;
  organizationSlug?: string;
}
```

## Step 3: Create JWT-Based Role Utilities

Replace your current role utilities with JWT-based ones:

```typescript
// lib/integrations/workos/rbac.ts
import type { WorkOSPermission, WorkOSRole, WorkOSUserWithRBAC } from '@/types/workos-rbac';
import { WORKOS_PERMISSIONS, WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { cache } from 'react';

/**
 * Get current user with RBAC information from JWT
 *
 * This is cached per request to avoid multiple auth checks
 */
export const getCurrentUser = cache(async (): Promise<WorkOSUserWithRBAC | null> => {
  try {
    const { user } = await withAuth();

    if (!user) return null;

    // Type assertion: AuthKit user includes RBAC claims in JWT
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: (user as any).role as WorkOSRole | undefined,
      permissions: (user as any).permissions as WorkOSPermission[] | undefined,
      organizationId: (user as any).organizationId,
      organizationSlug: (user as any).organizationSlug,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
});

/**
 * Get current user's role from JWT
 *
 * @returns Role slug or 'user' as default
 */
export async function getCurrentUserRole(): Promise<WorkOSRole> {
  const user = await getCurrentUser();
  return user?.role || WORKOS_ROLES.USER;
}

/**
 * Get current user's permissions from JWT
 *
 * @returns Array of permission slugs
 */
export async function getCurrentUserPermissions(): Promise<WorkOSPermission[]> {
  const user = await getCurrentUser();
  return user?.permissions || [];
}

/**
 * Check if current user has a specific role
 *
 * @param role - Role slug to check
 * @returns True if user has the role
 */
export async function hasRole(role: WorkOSRole): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  return userRole === role;
}

/**
 * Check if current user has any of the specified roles
 *
 * @param roles - Array of role slugs to check
 * @returns True if user has any of the roles
 */
export async function hasAnyRole(roles: WorkOSRole[]): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  return roles.includes(userRole);
}

/**
 * Check if current user has a specific permission
 *
 * @param permission - Permission slug to check
 * @returns True if user has the permission
 */
export async function hasPermission(permission: WorkOSPermission): Promise<boolean> {
  const permissions = await getCurrentUserPermissions();
  return permissions.includes(permission);
}

/**
 * Check if current user has all specified permissions
 *
 * @param requiredPermissions - Array of permission slugs to check
 * @returns True if user has all permissions
 */
export async function hasAllPermissions(requiredPermissions: WorkOSPermission[]): Promise<boolean> {
  const permissions = await getCurrentUserPermissions();
  return requiredPermissions.every((perm) => permissions.includes(perm));
}

/**
 * Check if current user has any of the specified permissions
 *
 * @param requiredPermissions - Array of permission slugs to check
 * @returns True if user has any of the permissions
 */
export async function hasAnyPermission(requiredPermissions: WorkOSPermission[]): Promise<boolean> {
  const permissions = await getCurrentUserPermissions();
  return requiredPermissions.some((perm) => permissions.includes(perm));
}

/**
 * Require user to have specific permission (throws if not)
 *
 * @param permission - Permission slug required
 * @throws Error if user doesn't have permission
 */
export async function requirePermission(permission: WorkOSPermission): Promise<void> {
  if (!(await hasPermission(permission))) {
    throw new Error(`Permission required: ${permission}`);
  }
}

/**
 * Require user to have specific role (throws if not)
 *
 * @param role - Role slug required
 * @throws Error if user doesn't have role
 */
export async function requireRole(role: WorkOSRole): Promise<void> {
  if (!(await hasRole(role))) {
    throw new Error(`Role required: ${role}`);
  }
}

// ============================================================================
// Convenience Helper Functions
// ============================================================================

export async function isAdmin(): Promise<boolean> {
  return hasAnyRole([WORKOS_ROLES.ADMIN, WORKOS_ROLES.SUPERADMIN]);
}

export async function isSuperAdmin(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.SUPERADMIN);
}

export async function isExpert(): Promise<boolean> {
  return hasAnyRole([
    WORKOS_ROLES.EXPERT_TOP,
    WORKOS_ROLES.EXPERT_COMMUNITY,
    WORKOS_ROLES.EXPERT_LECTURER,
  ]);
}

export async function isTopExpert(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_TOP);
}

export async function isCommunityExpert(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_COMMUNITY);
}

export async function isLecturer(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_LECTURER);
}

export async function canManageEvents(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.EVENTS_MANAGE);
}

export async function canApproveExperts(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.EXPERTS_APPROVE);
}

export async function canAccessAdvancedAnalytics(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.ANALYTICS_ADVANCED);
}
```

## Step 4: Create Client-Side RBAC Hooks

```typescript
// components/providers/RBACProvider.tsx

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { WorkOSPermission, WorkOSRole, WorkOSUserWithRBAC } from '@/types/workos-rbac';
import { WORKOS_ROLES } from '@/types/workos-rbac';

interface RBACContextValue {
  user: WorkOSUserWithRBAC | null;
  role: WorkOSRole;
  permissions: WorkOSPermission[];
  hasRole: (role: WorkOSRole) => boolean;
  hasAnyRole: (roles: WorkOSRole[]) => boolean;
  hasPermission: (permission: WorkOSPermission) => boolean;
  hasAnyPermission: (permissions: WorkOSPermission[]) => boolean;
  hasAllPermissions: (permissions: WorkOSPermission[]) => boolean;
  isLoading: boolean;
}

const RBACContext = createContext<RBACContextValue | undefined>(undefined);

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WorkOSUserWithRBAC | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/user/rbac');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user RBAC:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, []);

  const role = user?.role || WORKOS_ROLES.USER;
  const permissions = user?.permissions || [];

  const hasRole = (checkRole: WorkOSRole) => role === checkRole;

  const hasAnyRole = (roles: WorkOSRole[]) => roles.includes(role);

  const hasPermission = (permission: WorkOSPermission) =>
    permissions.includes(permission);

  const hasAnyPermission = (perms: WorkOSPermission[]) =>
    perms.some(p => permissions.includes(p));

  const hasAllPermissions = (perms: WorkOSPermission[]) =>
    perms.every(p => permissions.includes(p));

  return (
    <RBACContext.Provider
      value={{
        user,
        role,
        permissions,
        hasRole,
        hasAnyRole,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isLoading,
      }}
    >
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC() {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within RBACProvider');
  }
  return context;
}

// Convenience hooks
export function useIsAdmin() {
  const { hasAnyRole } = useRBAC();
  return hasAnyRole([WORKOS_ROLES.ADMIN, WORKOS_ROLES.SUPERADMIN]);
}

export function useIsExpert() {
  const { hasAnyRole } = useRBAC();
  return hasAnyRole([
    WORKOS_ROLES.EXPERT_TOP,
    WORKOS_ROLES.EXPERT_COMMUNITY,
    WORKOS_ROLES.EXPERT_LECTURER,
  ]);
}

export function useHasPermission(permission: WorkOSPermission) {
  const { hasPermission } = useRBAC();
  return hasPermission(permission);
}
```

```typescript
// app/api/user/rbac/route.ts
import { getCurrentUser } from '@/lib/integrations/workos/rbac';
import { NextResponse } from 'next/server';

/**
 * GET /api/user/rbac
 *
 * Returns current user's RBAC information from JWT
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user RBAC:', error);
    return NextResponse.json({ error: 'Failed to fetch user RBAC' }, { status: 500 });
  }
}
```

## Step 5: Create UI Components for Conditional Rendering

```typescript
// components/rbac/RequirePermission.tsx

'use client';

import { useRBAC } from '@/components/providers/RBACProvider';
import type { WorkOSPermission } from '@/types/workos-rbac';
import type { ReactNode } from 'react';

interface RequirePermissionProps {
  permission: WorkOSPermission | WorkOSPermission[];
  mode?: 'any' | 'all'; // Check any or all permissions
  fallback?: ReactNode;
  children: ReactNode;
}

export function RequirePermission({
  permission,
  mode = 'any',
  fallback = null,
  children,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = useRBAC();

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasAccess =
    permissions.length === 1
      ? hasPermission(permissions[0])
      : mode === 'all'
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

```typescript
// components/rbac/RequireRole.tsx

'use client';

import { useRBAC } from '@/components/providers/RBACProvider';
import type { WorkOSRole } from '@/types/workos-rbac';
import type { ReactNode } from 'react';

interface RequireRoleProps {
  role: WorkOSRole | WorkOSRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RequireRole({ role, fallback = null, children }: RequireRoleProps) {
  const { hasRole, hasAnyRole, isLoading } = useRBAC();

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const roles = Array.isArray(role) ? role : [role];
  const hasAccess = roles.length === 1 ? hasRole(roles[0]) : hasAnyRole(roles);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

## Step 6: Update Middleware for Route Protection

```typescript
// proxy.ts (updated middleware)
import { WORKOS_PERMISSIONS, WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define routes with required permissions
const PROTECTED_ROUTES = {
  '/dashboard/admin': {
    roles: [WORKOS_ROLES.ADMIN, WORKOS_ROLES.SUPERADMIN],
  },
  '/dashboard/expert': {
    roles: [WORKOS_ROLES.EXPERT_TOP, WORKOS_ROLES.EXPERT_COMMUNITY, WORKOS_ROLES.EXPERT_LECTURER],
  },
  '/dashboard/expert/analytics': {
    permissions: [WORKOS_PERMISSIONS.ANALYTICS_ADVANCED],
  },
  '/dashboard/admin/experts/approve': {
    permissions: [WORKOS_PERMISSIONS.EXPERTS_APPROVE],
  },
} as const;

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Get session from AuthKit
  const { session } = await withAuth();

  // Check if route requires protection
  for (const [routePath, requirements] of Object.entries(PROTECTED_ROUTES)) {
    if (path.startsWith(routePath)) {
      // Require authentication
      if (!session?.user) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }

      // Type assertion: AuthKit user includes RBAC claims
      const user = session.user as any;
      const userRole = user.role || WORKOS_ROLES.USER;
      const userPermissions = user.permissions || [];

      // Check role requirements
      if ('roles' in requirements) {
        const hasRole = requirements.roles.includes(userRole);
        if (!hasRole) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      }

      // Check permission requirements
      if ('permissions' in requirements) {
        const hasPermission = requirements.permissions.some((perm: string) =>
          userPermissions.includes(perm),
        );
        if (!hasPermission) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\..*|\\.well-known).*)'],
};
```

## Step 7: Update RLS Policies for Permission-Based Access

```sql
-- drizzle/migrations-manual/013_workos_rbac_rls.sql

/**
 * WorkOS RBAC + Neon RLS Integration
 *
 * This migration updates RLS policies to use permissions from JWT
 * instead of querying database for roles.
 */

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Extract user_id from JWT (already provided by Neon Auth)
-- auth.user_id() returns the 'sub' claim (WorkOS user ID)

-- Extract permissions array from JWT
CREATE OR REPLACE FUNCTION auth.jwt_permissions()
RETURNS text[] AS $$
  SELECT COALESCE(
    NULLIF(
      current_setting('request.jwt.claims', true)::jsonb->'permissions',
      'null'::jsonb
    )::text[],
    ARRAY[]::text[]
  )
$$ LANGUAGE sql STABLE;

-- Extract role from JWT
CREATE OR REPLACE FUNCTION auth.jwt_role()
RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    'user'
  )
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- DROP OLD ROLE-BASED POLICIES
-- ============================================================================

-- Events
DROP POLICY IF EXISTS "Admins can view all applications" ON expert_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON expert_applications;

-- ============================================================================
-- CREATE PERMISSION-BASED POLICIES
-- ============================================================================

-- Expert Applications: Permission-based approval
CREATE POLICY "Users with experts:approve can view all applications"
ON expert_applications FOR SELECT
USING ('experts:approve' = ANY(auth.jwt_permissions()));

CREATE POLICY "Users with experts:approve can update applications"
ON expert_applications FOR UPDATE
USING ('experts:approve' = ANY(auth.jwt_permissions()))
WITH CHECK ('experts:approve' = ANY(auth.jwt_permissions()));

-- Events: Owner or users with events:manage permission
CREATE POLICY "Event owner or users with events:manage can update"
ON events FOR UPDATE
USING (
  workos_user_id = auth.user_id()
  OR 'events:manage' = ANY(auth.jwt_permissions())
)
WITH CHECK (
  workos_user_id = auth.user_id()
  OR 'events:manage' = ANY(auth.jwt_permissions())
);

CREATE POLICY "Event owner or users with events:manage can delete"
ON events FOR DELETE
USING (
  workos_user_id = auth.user_id()
  OR 'events:manage' = ANY(auth.jwt_permissions())
);

-- Users: Admin permissions for user management
CREATE POLICY "Users with users:write can update any user"
ON users FOR UPDATE
USING ('users:write' = ANY(auth.jwt_permissions()))
WITH CHECK ('users:write' = ANY(auth.jwt_permissions()));

-- Reports/Analytics: Permission-based access
CREATE POLICY "Users with reports:access can view audit logs"
ON audit_logs FOR SELECT
USING ('reports:access' = ANY(auth.jwt_permissions()));

-- ============================================================================
-- COMBINED POLICIES (Owner OR Permission)
-- ============================================================================

-- Users can always access their own data, OR admins can access via permission
CREATE POLICY "Owner or users:read permission can view user"
ON users FOR SELECT
USING (
  workos_user_id = auth.user_id()
  OR 'users:read' = ANY(auth.jwt_permissions())
);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Create functional index on JWT extraction for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jwt_permissions
ON events ((auth.jwt_permissions()));

-- ============================================================================
-- TESTING
-- ============================================================================

-- Test permission extraction (run as authenticated user)
-- Should return user's permissions from JWT
-- SELECT auth.jwt_permissions();

-- Test role extraction
-- Should return user's role from JWT
-- SELECT auth.jwt_role();

-- Test combined policy
-- Should allow access if user owns event OR has events:manage permission
-- SELECT * FROM events;
```

## Step 8: Usage Examples

### Server Component Example

```typescript
// app/dashboard/expert/analytics/page.tsx

import { requirePermission } from '@/lib/integrations/workos/rbac';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';
import { redirect } from 'next/navigation';

export default async function AdvancedAnalyticsPage() {
  try {
    // Require permission - throws if not authorized
    await requirePermission(WORKOS_PERMISSIONS.ANALYTICS_ADVANCED);
  } catch {
    redirect('/unauthorized');
  }

  return (
    <div>
      <h1>Advanced Analytics</h1>
      {/* Advanced analytics content */}
    </div>
  );
}
```

### API Route Example

```typescript
// app/api/admin/experts/[id]/approve/route.ts
import { hasPermission } from '@/lib/integrations/workos/rbac';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Check permission
  if (!(await hasPermission(WORKOS_PERMISSIONS.EXPERTS_APPROVE))) {
    return NextResponse.json({ error: 'Permission required: experts:approve' }, { status: 403 });
  }

  const { id } = await params;

  // Approve expert application
  await approveExpertApplication(id);

  return NextResponse.json({ success: true });
}
```

### Client Component Example

```typescript
// app/dashboard/expert/events/EventActions.tsx

'use client';

import { RequirePermission } from '@/components/rbac/RequirePermission';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';
import { Button } from '@/components/ui/button';

export function EventActions({ eventId }: { eventId: string }) {
  return (
    <div className="flex gap-2">
      {/* Everyone can create events (with events:create permission) */}
      <RequirePermission permission={WORKOS_PERMISSIONS.EVENTS_CREATE}>
        <Button>Create Event</Button>
      </RequirePermission>

      {/* Only users with events:manage can delete */}
      <RequirePermission
        permission={WORKOS_PERMISSIONS.EVENTS_MANAGE}
        fallback={<span className="text-muted-foreground">Upgrade to delete events</span>}
      >
        <Button variant="destructive">Delete Event</Button>
      </RequirePermission>
    </div>
  );
}
```

### Conditional UI Rendering

```typescript
// app/dashboard/expert/page.tsx

'use client';

import { useHasPermission } from '@/components/providers/RBACProvider';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';

export default function ExpertDashboard() {
  const canAccessAdvancedAnalytics = useHasPermission(
    WORKOS_PERMISSIONS.ANALYTICS_ADVANCED
  );
  const canCustomizeBranding = useHasPermission(
    WORKOS_PERMISSIONS.BRANDING_CUSTOMIZE
  );

  return (
    <div>
      <h1>Expert Dashboard</h1>

      {/* Show upgrade CTA if they don't have top expert permissions */}
      {!canAccessAdvancedAnalytics && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3>Upgrade to Top Expert</h3>
          <p>Get access to advanced analytics and more!</p>
          <Button>Upgrade Now</Button>
        </div>
      )}

      {/* Advanced features only for top experts */}
      {canAccessAdvancedAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <AdvancedAnalyticsChart />
          </CardContent>
        </Card>
      )}

      {canCustomizeBranding && (
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingCustomizer />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## Step 9: Assign Roles via API

Update your user registration/onboarding to assign roles via WorkOS:

```typescript
// lib/integrations/workos/assign-role.ts
import { workos } from '@/lib/integrations/workos/client';
import type { WorkOSRole } from '@/types/workos-rbac';

/**
 * Assign role to user in organization via WorkOS API
 *
 * This updates the user's organization membership and the role
 * will automatically be included in their next JWT.
 */
export async function assignRoleToUser(
  workosUserId: string,
  organizationId: string,
  role: WorkOSRole,
): Promise<void> {
  // Get user's organization membership
  const { data: memberships } = await workos.userManagement.listOrganizationMemberships({
    userId: workosUserId,
    organizationId,
  });

  const membership = memberships[0];
  if (!membership) {
    throw new Error('User is not a member of this organization');
  }

  // Update membership with new role
  await workos.userManagement.updateOrganizationMembership({
    organizationMembershipId: membership.id,
    roleSlug: role,
  });

  console.log(`✅ Assigned role '${role}' to user ${workosUserId} in org ${organizationId}`);
}

/**
 * Example: Approve expert application and assign role
 */
export async function approveExpertApplication(applicationId: string): Promise<void> {
  const application = await db.query.ExpertApplicationsTable.findFirst({
    where: eq(ExpertApplicationsTable.id, applicationId),
  });

  if (!application) {
    throw new Error('Application not found');
  }

  // Get user's organization
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, application.workosUserId),
  });

  if (!user?.organizationId) {
    throw new Error('User organization not found');
  }

  // Assign expert role via WorkOS
  // (Determine tier based on application review)
  const roleToAssign = WORKOS_ROLES.EXPERT_COMMUNITY; // or EXPERT_TOP

  await assignRoleToUser(application.workosUserId, user.organizationId, roleToAssign);

  // Update application status
  await db
    .update(ExpertApplicationsTable)
    .set({
      status: 'approved',
      reviewedAt: new Date(),
    })
    .where(eq(ExpertApplicationsTable.id, applicationId));

  console.log(`✅ Expert application ${applicationId} approved`);
}
```

## Step 10: Testing

Create comprehensive tests:

```typescript
// __tests__/integration/workos-rbac.test.ts
import { assignRoleToUser } from '@/lib/integrations/workos/assign-role';
import { workos } from '@/lib/integrations/workos/client';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { describe, expect, it } from 'vitest';

describe('WorkOS RBAC Integration', () => {
  it('should assign role via WorkOS API', async () => {
    const userId = 'user_test_123';
    const orgId = 'org_test_123';

    await assignRoleToUser(userId, orgId, WORKOS_ROLES.EXPERT_TOP);

    // Verify role was assigned
    const { data: memberships } = await workos.userManagement.listOrganizationMemberships({
      userId,
      organizationId: orgId,
    });

    expect(memberships[0].role.slug).toBe(WORKOS_ROLES.EXPERT_TOP);
  });

  it('should include role in JWT after assignment', async () => {
    // This would require mocking or integration test with real JWT
    // See WorkOS documentation for JWT testing strategies
  });
});
```

## Migration Script

Create a script to migrate existing roles to WorkOS:

```typescript
// scripts/migrate-roles-to-workos.ts
import { db } from '@/drizzle/db';
import { UserOrgMembershipsTable, UsersTable } from '@/drizzle/schema-workos';
import { assignRoleToUser } from '@/lib/integrations/workos/assign-role';
import { WORKOS_ROLES } from '@/types/workos-rbac';

async function migrateRolesToWorkOS() {
  console.log('🚀 Starting role migration to WorkOS...');

  // Get all users with roles
  const users = await db.query.UsersTable.findMany({
    where: (users) => sql`${users.role} IS NOT NULL`,
  });

  console.log(`Found ${users.length} users with roles to migrate`);

  for (const user of users) {
    try {
      // Get user's organization membership
      const membership = await db.query.UserOrgMembershipsTable.findFirst({
        where: eq(UserOrgMembershipsTable.workosUserId, user.workosUserId),
      });

      if (!membership?.orgId) {
        console.warn(`⚠️  User ${user.workosUserId} has no organization, skipping`);
        continue;
      }

      // Map old role to new WorkOS role
      let workosRole: string;
      switch (user.role) {
        case 'admin':
          workosRole = WORKOS_ROLES.ADMIN;
          break;
        case 'superadmin':
          workosRole = WORKOS_ROLES.SUPERADMIN;
          break;
        case 'expert_top':
          workosRole = WORKOS_ROLES.EXPERT_TOP;
          break;
        case 'expert_community':
          workosRole = WORKOS_ROLES.EXPERT_COMMUNITY;
          break;
        case 'expert_lecturer':
          workosRole = WORKOS_ROLES.EXPERT_LECTURER;
          break;
        default:
          workosRole = WORKOS_ROLES.USER;
      }

      // Assign role via WorkOS
      await assignRoleToUser(user.workosUserId, membership.orgId, workosRole as any);

      console.log(`✅ Migrated ${user.email}: ${user.role} → ${workosRole}`);
    } catch (error) {
      console.error(`❌ Failed to migrate user ${user.email}:`, error);
    }
  }

  console.log('✅ Role migration complete!');
}

// Run migration
migrateRolesToWorkOS();
```

## Rollback Plan

If you need to rollback:

1. **Keep old role checking code** during transition period
2. **Feature flag** new RBAC system
3. **Gradual migration** - enable for subset of users first
4. **Monitor errors** and performance

```typescript
// lib/feature-flags.ts

export const FEATURES = {
  WORKOS_RBAC: process.env.NEXT_PUBLIC_ENABLE_WORKOS_RBAC === 'true',
};

// Use in code:
if (FEATURES.WORKOS_RBAC) {
  // New WorkOS RBAC code
  await hasPermission(WORKOS_PERMISSIONS.EVENTS_MANAGE);
} else {
  // Old role checking code
  const user = await db.query.UsersTable.findFirst(...);
  const hasRole = user.role === 'expert_top';
}
```

## Next Steps

1. ✅ Complete Steps 1-3 (WorkOS Dashboard configuration + Types)
2. ✅ Deploy Step 4 (JWT utilities) to staging
3. ✅ Test with sample users
4. ✅ Roll out Steps 5-6 (Client hooks + Middleware)
5. ✅ Update RLS policies (Step 7)
6. ✅ Run migration script (Step 9)
7. ✅ Monitor and iterate

## Support

If you need help:

- WorkOS Documentation: https://workos.com/docs/rbac
- Internal: `#engineering` Slack channel
- This guide: `_docs/02-core-systems/WORKOS-RBAC-IMPLEMENTATION-GUIDE.md`
