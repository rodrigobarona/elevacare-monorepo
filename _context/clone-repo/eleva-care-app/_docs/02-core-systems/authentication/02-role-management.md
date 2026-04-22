# Role Management Guide

## Overview

The application implements a robust role-based access control (RBAC) system using Clerk for authentication and centralized role management utilities. This guide explains how to implement and use role-based authorization throughout the application.

## Available Roles

The system supports the following roles:

```typescript
type UserRole = 'user' | 'community_expert' | 'top_expert' | 'lecturer' | 'admin' | 'superadmin';
```

## Centralized Role Management

The role system is implemented using a centralized approach, which makes role checking consistent across the entire application:

### 1. Server-Side Role Management (`/lib/auth/roles.server.ts`)

For server components, API routes, or server actions:

```typescript
import {
  hasAnyRole,
  hasRole,
  isAdmin,
  isCommunityExpert,
  isExpert,
  isTopExpert,
} from '@/lib/auth/roles.server';

// Check for a specific role
const hasAdminRole = await hasRole('admin');

// Check for any of multiple roles
const hasExpertRoles = await hasAnyRole(['community_expert', 'top_expert']);

// Specialized helper functions
const userIsAdmin = await isAdmin();
const userIsExpert = await isExpert();
const userIsTopExpert = await isTopExpert();
const userIsCommunityExpert = await isCommunityExpert();
```

### 2. Client-Side Role Management (`/components/molecules/AuthorizationProvider.tsx`)

For React components and client-side role checking:

```typescript
import {
  useAuthorization,
  useIsAdmin,
  useIsExpert,
  useIsTopExpert,
  useIsCommunityExpert,
  RequireRole
} from '@/components/molecules/AuthorizationProvider';

// General authorization context
const { hasRole, roles, isLoading } = useAuthorization();

// Specialized role hooks
const isAdmin = useIsAdmin();
const isExpert = useIsExpert();
const isTopExpert = useIsTopExpert();
const isCommunityExpert = useIsCommunityExpert();

// Conditional rendering component
<RequireRole roles="admin" fallback={<AccessDenied />}>
  <AdminPanel />
</RequireRole>
```

### 3. Middleware Route Protection (`/middleware.ts`)

For protecting entire routes based on roles:

```typescript
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
];
```

## Implementation Methods

There are three main ways to implement role-based access control in the application:

### 1. Server-Side Role Checking

```typescript
// In a Server Component
export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect('/unauthorized');
  }

  return <AdminContent />;
}

// In an API Route
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Process admin-only request
}
```

### 2. Client-Side Role Checking

```tsx
// Using hooks
function AdminComponent() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <AdminContent />;
}

// Using conditional rendering
function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <RequireRole roles="admin">
        <AdminControls />
      </RequireRole>

      <RequireRole roles={['community_expert', 'top_expert']}>
        <ExpertTools />
      </RequireRole>
    </div>
  );
}
```

### 3. Middleware Route Protection

Protected routes are defined in middleware.ts and applied automatically:

```typescript
// In middleware.ts
const protectedRoutes = [
  {
    path: '/admin',
    roles: ['admin', 'superadmin'],
    redirectUrl: '/',
  },
];

// Middleware logic checks user roles before allowing access to protected routes
```

## Best Practices

1. **Layer Security**: Implement role checks at multiple levels:
   - UI level (hide unauthorized content)
   - Client-side routing (prevent unauthorized navigation)
   - API routes (prevent unauthorized data access)
   - Server components (prevent unauthorized content rendering)
   - Middleware (prevent unauthorized route access)

2. **Use Helper Functions**:
   - Prefer specialized helpers like `isAdmin()` over generic `hasRole('admin')`
   - This improves code readability and maintainability

3. **Handle Loading States**:
   - Always check `isLoading` in client components
   - Provide appropriate loading indicators
   - Prevent UI flashing during role checks

4. **Consistent Redirection**:
   - Use standard redirection paths (e.g., `/unauthorized`, `/`)
   - Provide clear messaging about access restrictions

5. **Multiple Roles**:
   - Remember users can have multiple roles
   - Check for appropriate combinations with `hasAnyRole()`

## Common Use Cases

### Protecting Admin Routes

```typescript
// app/(private)/(settings)/admin/layout.tsx
import { isAdmin } from '@/lib/auth/roles.server';

export default async function AdminLayout({ children }) {
  const userIsAdmin = await isAdmin();

  if (!userIsAdmin) {
    redirect('/');
  }

  return (
    // Admin layout with navigation, etc.
    <main>{children}</main>
  );
}
```

### Role-Specific UI Elements

```tsx
import { useIsAdmin, useIsExpert } from '@/components/molecules/AuthorizationProvider';

function ActionButtons() {
  const isAdmin = useIsAdmin();
  const isExpert = useIsExpert();

  return (
    <div className="flex gap-2">
      {isAdmin && <AdminActionButton />}
      {isExpert && <ExpertActionButton />}
      <CommonActionButton />
    </div>
  );
}
```

### API Protection

```typescript
// app/api/admin/users/route.ts
import { isAdmin } from '@/lib/auth/roles.server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userIsAdmin = await isAdmin();
  if (!userIsAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch and return users data
}
```

## Troubleshooting

Common issues and their solutions:

1. **Role Not Being Recognized**:
   - Check Clerk dashboard to confirm role is set correctly
   - Ensure role spelling matches the type definition
   - Verify role is stored in the proper format (string vs array)

2. **Loading State Issues**:
   - Check if components are rendering before role checks complete
   - Add appropriate `isLoading` checks
   - Use Suspense boundaries for server components

3. **Multiple Roles Conflicts**:
   - Ensure `hasAnyRole()` is used when checking for multiple possible roles
   - Verify array format for multiple roles is correct
   - Debug by logging the actual roles with `console.log(user.publicMetadata.role)`

## Managing User Roles

To update a user's roles, use the `updateUserRole` function:

```typescript
import { updateUserRole } from '@/lib/auth/roles.server';

// Set a single role
await updateUserRole(userId, 'admin');

// Set multiple roles
await updateUserRole(userId, ['admin', 'top_expert']);
```

Note that only admin or superadmin users can update roles, and only superadmins can assign the superadmin role.

## Security Considerations

1. **Multiple Layers**: Always implement role checks at both client and server levels

2. **Error Messages**: Avoid revealing sensitive information in error messages

3. **Logging**: Implement proper logging for security events

4. **Updates**: Keep authentication and authorization libraries updated

5. **Testing**: Regularly test role-based access control functionality

## Future Enhancements

Consider these potential improvements:

1. Implement role hierarchies
2. Add permission-based access control
3. Create role management UI for administrators
4. Add audit logging for role changes
5. Implement role-based rate limiting

## Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Authentication](https://nextjs.org/docs/authentication)
- [React Security Best Practices](https://reactjs.org/docs/security.html)
