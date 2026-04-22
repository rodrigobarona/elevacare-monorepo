# Integrating Authorization with Private Layout

This document explains how to integrate the role-based authorization system with the private layout of the Eleva Care application.

## Overview

The private layout (`app/(private)/layout.tsx`) serves as the foundation for all authenticated pages in the application. By integrating authorization at this level, we can ensure that:

1. Navigation items are only shown to users with appropriate roles
2. Sections of the layout can be conditionally rendered based on permissions
3. Role-specific UI elements appear consistently throughout the app

## Updating the Private Layout

### Step 1: Integrate Role-Based Navigation

The sidebar navigation should be customized based on user roles. Here's how to modify the `AppSidebar` component:

```tsx
// components/organisms/sidebar/AppSidebar.tsx
import { useAuthorization } from '@/components/molecules/AuthorizationProvider';
import type { UserRole } from '@/lib/auth/roles';

export function AppSidebar() {
  const { hasRole, hasAnyRole, isLoading } = useAuthorization();

  // Define navigation items with role requirements
  const navItems = [
    {
      title: 'Dashboard',
      url: `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}`,
      icon: HomeIcon,
      roles: ['user', 'community_expert', 'top_expert', 'admin', 'superadmin'] as UserRole[],
    },
    {
      title: 'Appointments',
      url: '/appointments',
      icon: CalendarIcon,
      roles: ['community_expert', 'top_expert', 'admin', 'superadmin'] as UserRole[],
    },
    {
      title: 'Patients',
      url: '/appointments/patients',
      icon: UsersIcon,
      roles: ['community_expert', 'top_expert', 'admin', 'superadmin'] as UserRole[],
    },
    {
      title: 'Events',
      url: '/booking/events',
      icon: CalendarIcon,
      roles: ['community_expert', 'top_expert', 'admin', 'superadmin'] as UserRole[],
    },
    {
      title: 'Admin',
      url: '/admin',
      icon: ShieldIcon,
      roles: ['admin', 'superadmin'] as UserRole[],
      items: [
        {
          title: 'Users',
          url: '/admin/users',
          roles: ['admin', 'superadmin'] as UserRole[],
        },
        {
          title: 'Settings',
          url: '/admin/settings',
          roles: ['superadmin'] as UserRole[],
        },
      ],
    },
  ];

  // Filter navigation items based on user roles
  const filteredNavItems = navItems.filter((item) => !isLoading && hasAnyRole(item.roles));

  return (
    <aside className="...">
      {/* Render navigation */}
      <nav>
        {filteredNavItems.map((item) => (
          <NavItem key={item.url} item={item} hasAnyRole={hasAnyRole} />
        ))}
      </nav>
    </aside>
  );
}

// NavItem component with subitems filtering
function NavItem({ item, hasAnyRole }) {
  // Filter subitems based on roles
  const filteredSubItems = item.items?.filter((subitem) =>
    subitem.roles ? hasAnyRole(subitem.roles) : true,
  );

  // Only render subitems container if there are visible subitems
  const hasVisibleSubItems = filteredSubItems && filteredSubItems.length > 0;

  return (
    <div>
      <Link href={item.url}>{item.title}</Link>

      {hasVisibleSubItems && (
        <div className="subitems">
          {filteredSubItems.map((subitem) => (
            <Link key={subitem.url} href={subitem.url}>
              {subitem.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Update the Private Layout

Now, let's modify the private layout to include role-based elements:

```tsx
// app/(private)/layout.tsx
import { RequireRole } from '@/components/molecules/AuthorizationProvider';
import { AppBreadcrumb } from '@/components/organisms/sidebar/AppBreadcrumb';
import { AppSidebar } from '@/components/organisms/sidebar/AppSidebar';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface PrivateLayoutProps {
  children: ReactNode;
}

export default async function PrivateLayout({ children }: PrivateLayoutProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect(`${process.env.NEXT_PUBLIC_CLERK_UNAUTHORIZED_URL}`);
  }

  return (
    <PrivateLayoutWrapper>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-eleva-neutral-200/50 pl-2">
          <AppSidebar />
          <SidebarInset>
            <div className="w-full rounded-xl bg-background">
              <header className="flex h-16 shrink-0 items-center gap-2 rounded-t-xl border-b">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <AppBreadcrumb />

                  {/* Admin-only header elements */}
                  <div className="ml-auto flex items-center gap-2">
                    <RequireRole role={['admin', 'superadmin']}>
                      <AdminHeaderActions />
                    </RequireRole>
                  </div>
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="w-full rounded-xl bg-background">{children}</div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PrivateLayoutWrapper>
  );
}

// Admin-only header actions
function AdminHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/admin/notifications"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Notifications
      </Link>
      <Link href="/admin/system" className="text-sm text-muted-foreground hover:text-foreground">
        System Status
      </Link>
    </div>
  );
}
```

## Role-Based Breadcrumbs

Update the `AppBreadcrumb` component to be role-aware:

```tsx
// components/organisms/sidebar/AppBreadcrumb.tsx
import { useAuthorization } from '@/components/molecules/AuthorizationProvider';

export function AppBreadcrumb() {
  const { hasRole } = useAuthorization();
  const pathname = usePathname();

  // Custom breadcrumb items for admin sections
  if (pathname.startsWith('/admin') && !hasRole('admin') && !hasRole('superadmin')) {
    // User doesn't have admin role but somehow reached admin path
    return (
      <div className="flex items-center gap-1 text-sm text-destructive">
        <span>Unauthorized Section</span>
      </div>
    );
  }

  // Regular breadcrumb rendering...
}
```

## Role-Based UI Components

Create reusable role-based UI components for common patterns:

```tsx
// components/molecules/RoleBasedActionButton.tsx
import { RequireRole } from '@/components/molecules/AuthorizationProvider';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/lib/auth/roles';

interface RoleBasedActionButtonProps {
  role: UserRole | UserRole[];
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline-solid' | 'secondary' | 'ghost' | 'link';
}

export function RoleBasedActionButton({
  role,
  onClick,
  children,
  variant = 'default',
}: RoleBasedActionButtonProps) {
  return (
    <RequireRole role={role}>
      <Button variant={variant} onClick={onClick}>
        {children}
      </Button>
    </RequireRole>
  );
}
```

Usage example:

```tsx
<RoleBasedActionButton role="admin" onClick={handleDeleteUser}>
  Delete User
</RoleBasedActionButton>
```

## Handling Role-Specific Sections

For larger role-specific sections of the UI:

```tsx
// app/(private)/dashboard/page.tsx
import { RequireRole } from '@/components/molecules/AuthorizationProvider';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>

      {/* Everyone sees the overview section */}
      <OverviewSection />

      {/* Only experts see the appointments section */}
      <RequireRole role={['community_expert', 'top_expert']}>
        <AppointmentsSection />
      </RequireRole>

      {/* Only admins see the admin section */}
      <RequireRole role={['admin', 'superadmin']}>
        <AdminSection />
      </RequireRole>

      {/* Only superadmins see the system section */}
      <RequireRole role="superadmin">
        <SystemSection />
      </RequireRole>
    </div>
  );
}
```

## Best Practices

1. **Use Consistent Patterns**: Establish clear patterns for role-based UI elements and use them consistently.
2. **Loading States**: Always handle loading states to prevent UI flashing as roles are being fetched.
3. **Fallbacks**: Provide meaningful fallbacks for users who don't have required roles.
4. **Role Hierarchy**: Design UI to align with the natural hierarchy of roles.
5. **Server-Client Consistency**: Ensure that server-side and client-side role checks are consistent.
6. **Testing**: Test the UI with different user roles to verify proper rendering.

## Common Pitfalls

1. **Loading State Issues**: Without proper loading states, users might briefly see UI elements they shouldn't have access to.
2. **Server-Client Mismatch**: Pages protected on the server but not on the client (or vice versa) can lead to confusing experiences.
3. **Overly Restrictive UI**: Making navigation too restrictive can create confusion for users who are transitioning between roles.
4. **Role Dependencies**: Be careful with UI elements that depend on multiple role checks, as they can become brittle.

By following these guidelines, you can create a cohesive private section that adapts appropriately to each user's roles and permissions.
