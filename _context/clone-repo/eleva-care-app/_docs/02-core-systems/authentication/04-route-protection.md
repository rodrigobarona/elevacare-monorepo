# Route Protection Guide

## Overview

The application implements comprehensive route protection to ensure users can only access pages and resources for which they have appropriate permissions. This guide explains the different approaches to route protection in the application.

## Route Protection Layers

Our application implements route protection at three distinct layers:

1. **Middleware Layer**: Global protection for route patterns
2. **Server Component Layer**: Role checking in layouts and pages
3. **Client Component Layer**: Conditional rendering based on roles

## 1. Middleware Route Protection

The most comprehensive protection is implemented in the middleware, which runs before any route is accessed.

### Implementation in `middleware.ts`

```typescript
import { authMiddleware, clerkClient } from '@clerk/nextjs';
import { NextResponse } from 'next/server';

// Define routes that require specific roles
const protectedRoutes = [
  {
    path: '/admin',
    roles: ['admin', 'superadmin'],
    redirectUrl: '/',
  },
  {
    path: '/expert',
    roles: ['top_expert', 'community_expert'],
    redirectUrl: '/',
  },
  {
    path: '/top-expert',
    roles: ['top_expert'],
    redirectUrl: '/',
  },
];

// Auth middleware with role-based protection
export default authMiddleware({
  publicRoutes: [
    '/',
    '/about',
    '/login',
    '/sign-up',
    '/api/webhook',
    // Add other public routes
  ],
  async afterAuth(auth, req) {
    // Check if authenticated and attempting to access protected route
    if (auth.userId && req.nextUrl.pathname) {
      const pathname = req.nextUrl.pathname;

      // Find if the route is protected
      const protectedRoute = protectedRoutes.find((route) => pathname.startsWith(route.path));

      if (protectedRoute) {
        // Get user to check roles
        const user = await clerkClient.users.getUser(auth.userId);
        const userRoles = user.publicMetadata.role || [];

        // Convert to array if it's a string
        const roles = Array.isArray(userRoles) ? userRoles : [userRoles];

        // Check if user has any of the required roles
        const hasRequiredRole = protectedRoute.roles.some((role) => roles.includes(role));

        if (!hasRequiredRole) {
          // Redirect to specified URL if user lacks required roles
          return NextResponse.redirect(new URL(protectedRoute.redirectUrl, req.url));
        }
      }
    }

    return NextResponse.next();
  },
});

// Specify which routes the middleware should run on
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/(api|trpc)(.*)'],
};
```

### How It Works

1. Define `protectedRoutes` array with paths, required roles, and redirect URLs
2. In the `afterAuth` function, check if the user is trying to access a protected route
3. Get the user's roles from Clerk metadata
4. Check if the user has any of the required roles for the route
5. If not, redirect to the specified URL
6. The `matcher` ensures the middleware runs on all routes except static assets

## 2. Server Component Protection

For more specific protection within route groups or layouts, use server component checks:

### Layout-Level Protection

```typescript
// app/(private)/(settings)/admin/layout.tsx
import { isAdmin } from '@/lib/auth/roles.server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }) {
  // Check if user is an admin
  const userIsAdmin = await isAdmin();

  // Redirect if not an admin
  if (!userIsAdmin) {
    redirect('/');
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
```

### Page-Level Protection

```typescript
// app/(private)/expert-dashboard/page.tsx
import { isExpert } from '@/lib/auth/roles.server';
import { redirect } from 'next/navigation';

export default async function ExpertDashboardPage() {
  // Check if user is an expert
  const userIsExpert = await isExpert();

  // Redirect if not an expert
  if (!userIsExpert) {
    redirect('/unauthorized');
  }

  return <ExpertDashboard />;
}
```

## 3. Client Component Protection

For client-side route protection or conditional rendering:

### Using Specialized Hooks

```tsx
import { useIsAdmin } from '@/components/molecules/AuthorizationProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AdminPanel() {
  const isAdmin = useIsAdmin();
  const router = useRouter();

  useEffect(() => {
    if (isAdmin === false) {
      // Check it's exactly false (not undefined or loading)
      router.push('/unauthorized');
    }
  }, [isAdmin, router]);

  if (!isAdmin) {
    return null; // Don't render anything while redirecting
  }

  return <AdminPanelContent />;
}
```

### Using RequireRole Component

```tsx
import { RequireRole } from '@/components/molecules/AuthorizationProvider';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <RequireRole roles="admin" fallback={<AccessDenied />}>
        <AdminControls />
      </RequireRole>

      <RequireRole roles={['community_expert', 'top_expert']}>
        <ExpertTools />
      </RequireRole>
    </div>
  );
}
```

## Best Practices

1. **Defense in Depth**: Implement protection at multiple layers
   - Middleware for broad route protection
   - Server components for specific layouts/pages
   - Client components for dynamic content

2. **Performance Considerations**:
   - Use layout-level protection to avoid redundant checks in child pages
   - Middleware protection is most efficient for entire route groups

3. **UX Guidelines**:
   - Provide clear feedback when redirecting users
   - Use consistent redirect destinations
   - Implement proper loading states during role checks

4. **Testing Protection**:
   - Create tests with users of different roles
   - Verify redirects work as expected
   - Test edge cases like expired sessions

## Common Use Cases

### Admin Section Protection

```typescript
// Middleware handles /admin/* routes automatically
// Additional protection in layout

// app/(private)/(settings)/admin/layout.tsx
import { isAdmin } from '@/lib/auth/roles.server';

export default async function AdminLayout({ children }) {
  if (!(await isAdmin())) {
    redirect('/');
  }

  return (
    <AdminDashboardLayout>
      {children}
    </AdminDashboardLayout>
  );
}
```

### Expert Portal Protection

```typescript
// Middleware handles /expert/* routes automatically
// Additional logic for different expert types

// app/(private)/expert/layout.tsx
import { isExpert, isTopExpert } from '@/lib/auth/roles.server';

export default async function ExpertLayout({ children }) {
  // Verify user is any type of expert
  if (!(await isExpert())) {
    redirect('/');
  }

  // Get if user is a top expert for conditional rendering
  const userIsTopExpert = await isTopExpert();

  return (
    <ExpertDashboardLayout isTopExpert={userIsTopExpert}>
      {children}
    </ExpertDashboardLayout>
  );
}
```

### API Route Protection

```typescript
// app/api/admin/settings/route.ts
import { isAdmin } from '@/lib/auth/roles.server';
import { NextResponse } from 'next/server';

export async function GET() {
  // Check if user is admin
  const userIsAdmin = await isAdmin();

  if (!userIsAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Process admin-only request
}
```

## Troubleshooting

Common issues and solutions:

1. **Infinite Redirects**:
   - Check for circular redirects in middleware
   - Verify middleware logic correctly identifies protected routes
   - Ensure public routes are properly excluded from protection

2. **Flashing Content**:
   - Use `isLoading` states in client components
   - Ensure server components check roles before rendering content
   - Consider using suspense boundaries

3. **Excessive Role Checks**:
   - Use layout components for role checks instead of individual pages
   - Cache role results when appropriate
   - Use `AuthorizationProvider` to provide role context to all children
