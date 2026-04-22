# RBAC & Dynamic Sidebar Implementation Guide

**Version:** 1.0  
**Last Updated:** November 6, 2025  
**Status:** 🔧 Technical Implementation Guide

---

## 📋 Overview

This document provides step-by-step implementation details for the Role-Based Access Control (RBAC) system and dynamic sidebar navigation for Eleva, following the design specified in `ROLE-PROGRESSION-SYSTEM.md`.

---

## 🗂️ File Structure

```
lib/
├── auth/
│   ├── permissions.ts          # Permission definitions
│   ├── rbac-middleware.ts      # RBAC middleware functions
│   └── role-checks.ts          # Helper functions
├── hooks/
│   └── use-auth-role.ts        # Client-side auth hook
config/
├── navigation.ts               # Navigation configuration
├── stripe-subscriptions.ts     # Subscription plans
components/
├── layout/
│   └── sidebar/
│       ├── DynamicSidebar.tsx     # Main sidebar component
│       ├── NavItem.tsx            # Individual nav item
│       └── RoleBasedSection.tsx   # Conditional sections
server/
└── actions/
    ├── subscriptions.ts        # Subscription management
    └── expert-evaluation.ts    # Metrics & evaluation
```

---

## 🔐 Step 1: Permission System

### Create Permission Definitions

```typescript
// lib/auth/permissions.ts
import { UserRole } from '@/drizzle/schema-workos';

/**
 * Permission definitions following the principle of least privilege.
 * Each permission is explicitly granted to specific roles.
 */
export const PERMISSIONS = {
  // === Patient Permissions ===
  'bookings.create': ['patient', 'expert_community', 'expert_top', 'expert_lecturer'],
  'bookings.view_own': ['patient', 'expert_community', 'expert_top', 'expert_lecturer'],
  'bookings.cancel_own': ['patient', 'expert_community', 'expert_top', 'expert_lecturer'],
  'reviews.create': ['patient'],
  'profile.edit_basic': ['patient', 'expert_community', 'expert_top', 'expert_lecturer'],

  // === Community Expert Permissions ===
  'services.create': ['expert_community', 'expert_top', 'expert_lecturer'],
  'services.edit': ['expert_community', 'expert_top', 'expert_lecturer'],
  'services.delete': ['expert_community', 'expert_top', 'expert_lecturer'],
  'calendar.manage': ['expert_community', 'expert_top', 'expert_lecturer'],
  'availability.set': ['expert_community', 'expert_top', 'expert_lecturer'],
  'bookings.view_incoming': ['expert_community', 'expert_top', 'expert_lecturer'],
  'earnings.view': ['expert_community', 'expert_top', 'expert_lecturer'],
  'payout.request': ['expert_community', 'expert_top', 'expert_lecturer'],
  'profile.customize': ['expert_community', 'expert_top', 'expert_lecturer'],

  // === Top Expert Exclusive Permissions ===
  'analytics.advanced': ['expert_top'],
  'analytics.competitors': ['expert_top'],
  'branding.customize': ['expert_top'],
  'branding.upload_assets': ['expert_top'],
  'group_sessions.create': ['expert_top'],
  'group_sessions.manage': ['expert_top'],
  'messaging.direct_patients': ['expert_top'],
  'promotions.create': ['expert_top'],
  'featured.request': ['expert_top'],
  'payout.instant': ['expert_top'],

  // === Lecturer Permissions ===
  'courses.create': ['expert_lecturer'],
  'courses.edit': ['expert_lecturer'],
  'courses.publish': ['expert_lecturer'],
  'students.manage': ['expert_lecturer'],
  'webinars.host': ['expert_lecturer'],
  'content.upload': ['expert_lecturer'],
  'assessments.create': ['expert_lecturer'],

  // === Enterprise Permissions ===
  'organization.view': ['enterprise_admin', 'enterprise_member'],
  'organization.edit': ['enterprise_admin'],
  'team.invite': ['enterprise_admin'],
  'team.remove': ['enterprise_admin'],
  'team.view': ['enterprise_admin', 'enterprise_member'],
  'api.access': ['enterprise_admin'],
  'api.regenerate_keys': ['enterprise_admin'],
  'branding.enterprise': ['enterprise_admin'],
  'subdomain.manage': ['enterprise_admin'],

  // === Admin Permissions ===
  'users.view_all': ['admin', 'moderator'],
  'users.edit': ['admin'],
  'users.suspend': ['admin', 'moderator'],
  'experts.approve': ['admin', 'moderator'],
  'experts.reject': ['admin', 'moderator'],
  'platform.configure': ['admin'],
  'platform.analytics': ['admin'],
  'billing.manage_all': ['admin'],
  'content.moderate': ['admin', 'moderator'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(permission: Permission, userRole: UserRole | undefined): boolean {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(userRole);
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(
  permissions: Permission[],
  userRole: UserRole | undefined,
): boolean {
  return permissions.every((permission) => hasPermission(permission, userRole));
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(
  permissions: Permission[],
  userRole: UserRole | undefined,
): boolean {
  return permissions.some((permission) => hasPermission(permission, userRole));
}

/**
 * Get all permissions for a specific role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    PERMISSIONS[permission].includes(role),
  );
}
```

---

## 🛡️ Step 2: RBAC Middleware

### Create Server-Side Protection

```typescript
// lib/auth/rbac-middleware.ts
import type { UserRole } from '@/drizzle/schema-workos';
import { getUserApplicationRole } from '@/lib/integrations/workos/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

import { hasAllPermissions, hasPermission, type Permission } from './permissions';

/**
 * Require user to have one of the specified roles
 * Throws error if unauthorized
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const { user } = await withAuth({ ensureSignedIn: true });

  if (!user) {
    redirect('/login');
  }

  const userRole = await getUserApplicationRole(user.id);

  if (!allowedRoles.includes(userRole as UserRole)) {
    redirect('/unauthorized');
  }

  return { user, role: userRole as UserRole };
}

/**
 * Require user to have a specific permission
 * Throws error if unauthorized
 */
export async function requirePermission(permission: Permission) {
  const { user } = await withAuth({ ensureSignedIn: true });

  if (!user) {
    redirect('/login');
  }

  const userRole = await getUserApplicationRole(user.id);

  if (!hasPermission(permission, userRole as UserRole)) {
    redirect('/unauthorized');
  }

  return { user, role: userRole as UserRole };
}

/**
 * Require user to have ALL specified permissions
 */
export async function requireAllPermissions(permissions: Permission[]) {
  const { user } = await withAuth({ ensureSignedIn: true });

  if (!user) {
    redirect('/login');
  }

  const userRole = await getUserApplicationRole(user.id);

  if (!hasAllPermissions(permissions, userRole as UserRole)) {
    redirect('/unauthorized');
  }

  return { user, role: userRole as UserRole };
}

/**
 * Check role without redirecting (returns boolean)
 */
export async function checkRole(allowedRoles: UserRole[]): Promise<boolean> {
  try {
    const { user } = await withAuth();
    if (!user) return false;

    const userRole = await getUserApplicationRole(user.id);
    return allowedRoles.includes(userRole as UserRole);
  } catch {
    return false;
  }
}

/**
 * Get current user with role information
 */
export async function getCurrentUserWithRole() {
  const { user } = await withAuth();

  if (!user) {
    return null;
  }

  const role = await getUserApplicationRole(user.id);

  return {
    user,
    role: role as UserRole,
  };
}
```

---

## 🎣 Step 3: Client-Side Auth Hook

### Create Custom Hook for Client Components

```typescript
// hooks/use-auth-role.ts

'use client';

import type { UserRole } from '@/drizzle/schema-workos';
import type { Permission } from '@/lib/auth/permissions';
import { hasPermission as checkPermission } from '@/lib/auth/permissions';
import { useAuth as useWorkOSAuth } from '@workos-inc/authkit-nextjs/components';
import { useEffect, useState } from 'react';

// hooks/use-auth-role.ts

// hooks/use-auth-role.ts

interface AuthRoleData {
  user: ReturnType<typeof useWorkOSAuth>['user'];
  role: UserRole | null;
  loading: boolean;
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isExpert: boolean;
  isTopExpert: boolean;
  isPatient: boolean;
  isAdmin: boolean;
}

/**
 * Custom hook that combines WorkOS auth with role information
 */
export function useAuthRole(): AuthRoleData {
  const { user, loading: authLoading } = useWorkOSAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user/role');
        if (!response.ok) throw new Error('Failed to fetch role');

        const data = await response.json();
        setRole(data.role);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const hasPermission = (permission: Permission): boolean => {
    return checkPermission(permission, role || undefined);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    return role ? roles.includes(role) : false;
  };

  // Computed properties for common role checks
  const isExpert = hasRole(['expert_community', 'expert_top', 'expert_lecturer']);
  const isTopExpert = hasRole(['expert_top']);
  const isPatient = hasRole(['patient']);
  const isAdmin = hasRole(['admin', 'moderator']);

  // Get all permissions for current role
  const permissions: Permission[] = []; // Could be computed from role

  return {
    user,
    role,
    loading: authLoading || loading,
    permissions,
    hasPermission,
    hasRole,
    isExpert,
    isTopExpert,
    isPatient,
    isAdmin,
  };
}
```

### Create API Route for Role Fetching

```typescript
// app/api/user/role/route.ts
import { getUserApplicationRole } from '@/lib/integrations/workos/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserApplicationRole(user.id);

    return NextResponse.json({
      role,
      userId: user.id,
    });
  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## 🎨 Step 4: Dynamic Sidebar Configuration

### Create Navigation Config

```typescript
// config/navigation.ts
import type { UserRole } from '@/drizzle/schema-workos';
import type { Permission } from '@/lib/auth/permissions';
import {
  AcademicCapIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  HomeIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  label: string;
  path: string;
  icon: typeof HomeIcon;
  requiredRole?: UserRole[];
  requiredPermission?: Permission;
  badge?: {
    count: number;
    variant: 'default' | 'success' | 'warning' | 'danger';
  };
  children?: NavigationItem[];
  separator?: boolean; // Add separator before this item
}

/**
 * Main navigation configuration
 * Items are filtered based on user's role and permissions
 */
export const NAVIGATION_CONFIG: NavigationItem[] = [
  // === Common Section ===
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: HomeIcon,
  },

  // === Patient Section ===
  {
    label: 'Browse Experts',
    path: '/booking',
    icon: UserIcon,
    requiredRole: ['patient'],
  },
  {
    label: 'My Appointments',
    path: '/appointments',
    icon: CalendarIcon,
    requiredRole: ['patient'],
  },

  // === Community Expert Section ===
  {
    label: 'Expert Hub',
    path: '/expert',
    icon: ChartBarIcon,
    requiredRole: ['expert_community', 'expert_top', 'expert_lecturer'],
    separator: true,
    children: [
      {
        label: 'Overview',
        path: '/expert/dashboard',
        icon: HomeIcon,
      },
      {
        label: 'Services',
        path: '/expert/services',
        icon: CalendarIcon,
        requiredPermission: 'services.create',
      },
      {
        label: 'Calendar',
        path: '/expert/calendar',
        icon: CalendarIcon,
        requiredPermission: 'calendar.manage',
      },
      {
        label: 'Bookings',
        path: '/expert/bookings',
        icon: CalendarIcon,
        requiredPermission: 'bookings.view_incoming',
      },
      {
        label: 'Earnings',
        path: '/expert/earnings',
        icon: CurrencyDollarIcon,
        requiredPermission: 'earnings.view',
      },
      {
        label: 'Reviews',
        path: '/expert/reviews',
        icon: SparklesIcon,
      },
    ],
  },

  // === Top Expert Exclusive ===
  {
    label: 'Advanced',
    path: '/expert/advanced',
    icon: SparklesIcon,
    requiredRole: ['expert_top'],
    children: [
      {
        label: 'Analytics',
        path: '/expert/analytics',
        icon: ChartBarIcon,
        requiredPermission: 'analytics.advanced',
      },
      {
        label: 'Branding',
        path: '/expert/branding',
        icon: SparklesIcon,
        requiredPermission: 'branding.customize',
      },
      {
        label: 'Group Sessions',
        path: '/expert/group-sessions',
        icon: UsersIcon,
        requiredPermission: 'group_sessions.create',
      },
      {
        label: 'Promotions',
        path: '/expert/promotions',
        icon: SparklesIcon,
        requiredPermission: 'promotions.create',
      },
    ],
  },

  // === Lecturer Section ===
  {
    label: 'Teaching',
    path: '/lecturer',
    icon: AcademicCapIcon,
    requiredRole: ['expert_lecturer'],
    separator: true,
    children: [
      {
        label: 'Courses',
        path: '/lecturer/courses',
        icon: AcademicCapIcon,
        requiredPermission: 'courses.create',
      },
      {
        label: 'Students',
        path: '/lecturer/students',
        icon: UsersIcon,
        requiredPermission: 'students.manage',
      },
      {
        label: 'Webinars',
        path: '/lecturer/webinars',
        icon: CalendarIcon,
        requiredPermission: 'webinars.host',
      },
      {
        label: 'Content Library',
        path: '/lecturer/content',
        icon: AcademicCapIcon,
        requiredPermission: 'content.upload',
      },
    ],
  },

  // === Enterprise Section ===
  {
    label: 'Enterprise',
    path: '/enterprise',
    icon: BuildingOfficeIcon,
    requiredRole: ['enterprise_admin', 'enterprise_member'],
    separator: true,
    children: [
      {
        label: 'Dashboard',
        path: '/enterprise/dashboard',
        icon: HomeIcon,
      },
      {
        label: 'Team',
        path: '/enterprise/team',
        icon: UsersIcon,
        requiredPermission: 'team.view',
      },
      {
        label: 'Experts',
        path: '/enterprise/experts',
        icon: UserIcon,
      },
      {
        label: 'API Keys',
        path: '/enterprise/api',
        icon: Cog6ToothIcon,
        requiredPermission: 'api.access',
      },
    ],
  },

  // === Settings (All Users) ===
  {
    label: 'Account',
    path: '/account',
    icon: UserIcon,
    separator: true,
    children: [
      {
        label: 'Profile',
        path: '/account/profile',
        icon: UserIcon,
      },
      {
        label: 'Billing',
        path: '/account/billing',
        icon: CreditCardIcon,
      },
      {
        label: 'Settings',
        path: '/account/settings',
        icon: Cog6ToothIcon,
      },
    ],
  },
];

/**
 * Filter navigation items based on user role and permissions
 */
export function filterNavigation(
  items: NavigationItem[],
  userRole: UserRole | null,
  hasPermission: (permission: Permission) => boolean,
): NavigationItem[] {
  return items.filter((item) => {
    // Check role requirement
    if (item.requiredRole && (!userRole || !item.requiredRole.includes(userRole))) {
      return false;
    }

    // Check permission requirement
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
      return false;
    }

    // Recursively filter children
    if (item.children) {
      const filteredChildren = filterNavigation(item.children, userRole, hasPermission);
      // Only include parent if it has visible children
      if (filteredChildren.length === 0) {
        return false;
      }
      // Update children with filtered list
      item.children = filteredChildren;
    }

    return true;
  });
}
```

---

## 🎯 Step 5: Dynamic Sidebar Component

### Main Sidebar Component

```typescript
// components/layout/sidebar/DynamicSidebar.tsx

'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthRole } from '@/hooks/use-auth-role';
import { NAVIGATION_CONFIG, filterNavigation, type NavigationItem } from '@/config/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/layout/sidebar/sidebar';
import { NavUser } from './NavUser';
import { ElevaLogo } from '@/components/icons';

export function DynamicSidebar() {
  const { role, loading, hasPermission: checkPermission } = useAuthRole();
  const pathname = usePathname();

  // Filter navigation based on role and permissions
  const visibleItems = React.useMemo(() => {
    if (loading || !role) return [];
    return filterNavigation(NAVIGATION_CONFIG, role, checkPermission);
  }, [role, loading, checkPermission]);

  if (loading) {
    return <SidebarSkeleton />;
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-4">
          <ElevaLogo className="h-8 w-8" />
          <span className="text-xl font-semibold">Eleva</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {visibleItems.map((item, index) => (
            <React.Fragment key={item.path}>
              {item.separator && index > 0 && <Separator className="my-2" />}
              <NavItem item={item} pathname={pathname} />
            </React.Fragment>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

function NavItem({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
  const hasChildren = item.children && item.children.length > 0;

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={item.path}>
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
            {item.badge && (
              <Badge variant={item.badge.variant} className="ml-auto">
                {item.badge.count}
              </Badge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href={item.path}>
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuSub>
        {item.children.map(child => (
          <SidebarMenuSubItem key={child.path}>
            <SidebarMenuSubButton
              asChild
              isActive={pathname === child.path || pathname.startsWith(child.path + '/')}
            >
              <Link href={child.path}>
                <child.icon className="h-4 w-4" />
                <span>{child.label}</span>
                {child.badge && (
                  <Badge variant={child.badge.variant} size="sm" className="ml-auto">
                    {child.badge.count}
                  </Badge>
                )}
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

function SidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Skeleton className="h-12 w-full" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {[...Array(6)].map((_, i) => (
            <SidebarMenuItem key={i}>
              <Skeleton className="h-10 w-full" />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
```

---

## ✅ Step 6: Usage Examples

### Protecting a Page Route

```typescript
// app/(private)/expert/services/page.tsx

import { requirePermission } from '@/lib/auth/rbac-middleware';
import { ServicesManager } from '@/components/features/services/ServicesManager';

export default async function ExpertServicesPage() {
  // Require 'services.create' permission
  const { user, role } = await requirePermission('services.create');

  return (
    <div>
      <h1>Manage Your Services</h1>
      <ServicesManager userId={user.id} role={role} />
    </div>
  );
}
```

### Protecting an API Route

```typescript
// app/api/expert/services/route.ts
import { db } from '@/drizzle/db';
import { requirePermission } from '@/lib/auth/rbac-middleware';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Require permission
    const { user } = await requirePermission('services.create');

    const body = await request.json();

    // Create service
    const service = await db.insert(ServicesTable).values({
      workosUserId: user.id,
      ...body,
    });

    return NextResponse.json({ success: true, service });
  } catch (error) {
    if (error.message.includes('permission')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Conditional Rendering in Client Component

```typescript
// components/features/expert/ExpertDashboard.tsx

'use client';

import { useAuthRole } from '@/hooks/use-auth-role';
import { AdvancedAnalytics } from './AdvancedAnalytics';
import { BasicStats } from './BasicStats';

export function ExpertDashboard() {
  const { role, hasPermission, isTopExpert, loading } = useAuthRole();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      <h1>Expert Dashboard</h1>

      {/* Everyone sees basic stats */}
      <BasicStats />

      {/* Only Top Experts see advanced analytics */}
      {isTopExpert && hasPermission('analytics.advanced') && (
        <AdvancedAnalytics />
      )}

      {/* Conditional feature based on permission */}
      {hasPermission('group_sessions.create') && (
        <GroupSessionsManager />
      )}
    </div>
  );
}
```

---

## 🎓 Best Practices

1. **Always validate on the server** - Never trust client-side permission checks
2. **Use specific permissions** - Prefer `services.create` over broad `expert.manage`
3. **Fail closed** - If role is unknown, deny access by default
4. **Audit critical actions** - Log all permission checks for security audits
5. **Keep navigation config DRY** - Define once, filter dynamically
6. **Test edge cases** - Test role transitions, expired subscriptions, etc.

---

## 🧪 Testing

### Test Role Transitions

```typescript
// tests/auth/role-transitions.test.ts

describe('Role Transitions', () => {
  it('should grant Top Expert permissions after upgrade', async () => {
    // Start as Community Expert
    const user = await createTestUser({ role: 'expert_community' });

    // Verify basic permissions
    expect(hasPermission('services.create', user.role)).toBe(true);
    expect(hasPermission('analytics.advanced', user.role)).toBe(false);

    // Upgrade to Top Expert
    await upgradeUserRole(user.id, 'expert_top');

    // Verify new permissions
    expect(hasPermission('analytics.advanced', 'expert_top')).toBe(true);
    expect(hasPermission('branding.customize', 'expert_top')).toBe(true);
  });
});
```

---

## 📚 Related Documentation

- [Role Progression System](./ROLE-PROGRESSION-SYSTEM.md)
- [WorkOS Integration](../09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md)
- [Stripe Subscriptions](../../config/stripe.ts)

---

_This implementation guide is maintained alongside the main role progression design document._
