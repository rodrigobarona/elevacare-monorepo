# WorkOS RBAC Quick Reference

## Before vs After Comparison

### Role Checking

| **Before (Custom)**                        | **After (WorkOS RBAC)**             |
| ------------------------------------------ | ----------------------------------- |
| 3 database queries per check               | 0 queries (read from JWT)           |
| `await db.query.UsersTable.findFirst(...)` | `const { user } = await withAuth()` |
| Role stored in 3 tables                    | Role in JWT only                    |
| Manual role sync                           | Automatic via WorkOS                |

### Permission Checking

| **Before**        | **After**                        |
| ----------------- | -------------------------------- |
| Not implemented   | `hasPermission('events:manage')` |
| Role-based only   | Granular permissions             |
| Hardcoded in code | Configurable in dashboard        |

### Code Complexity

| **Before**                                     | **After**                                     |
| ---------------------------------------------- | --------------------------------------------- |
| `lib/integrations/workos/roles.ts` (217 lines) | `lib/integrations/workos/rbac.ts` (120 lines) |
| Multiple database tables                       | JWT claims only                               |
| Complex role merging logic                     | Simple JWT extraction                         |

## Common Patterns

### Server Components

```typescript
// Check permission
import { hasPermission } from '@/lib/integrations/workos/rbac';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';

export default async function Page() {
  if (!await hasPermission(WORKOS_PERMISSIONS.EVENTS_MANAGE)) {
    return <Unauthorized />;
  }
  return <Content />;
}

// Require permission (throws if unauthorized)
import { requirePermission } from '@/lib/integrations/workos/rbac';

export default async function Page() {
  await requirePermission(WORKOS_PERMISSIONS.ANALYTICS_ADVANCED);
  return <AdvancedAnalytics />;
}

// Check role
import { isTopExpert } from '@/lib/integrations/workos/rbac';

export default async function Page() {
  const isTopTier = await isTopExpert();
  return <Dashboard showAdvanced={isTopTier} />;
}
```

### API Routes

```typescript
import { getCurrentUser, hasPermission } from '@/lib/integrations/workos/rbac';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';

export async function POST(request: Request) {
  // Get user from JWT
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check permission
  if (!(await hasPermission(WORKOS_PERMISSIONS.USERS_WRITE))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Process request
  return NextResponse.json({ success: true });
}
```

### Client Components

```typescript
'use client';

import { RequirePermission } from '@/components/rbac/RequirePermission';
import { useRBAC } from '@/components/providers/RBACProvider';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';

export function EventActions() {
  const { hasPermission } = useRBAC();
  const canManage = hasPermission(WORKOS_PERMISSIONS.EVENTS_MANAGE);

  return (
    <div>
      {/* Conditional rendering */}
      {canManage && <DeleteButton />}

      {/* Component wrapper */}
      <RequirePermission permission={WORKOS_PERMISSIONS.EVENTS_CREATE}>
        <CreateButton />
      </RequirePermission>

      {/* With fallback */}
      <RequirePermission
        permission={WORKOS_PERMISSIONS.ANALYTICS_ADVANCED}
        fallback={<UpgradeCTA />}
      >
        <AdvancedFeatures />
      </RequirePermission>
    </div>
  );
}
```

### Middleware (Route Protection)

```typescript
// proxy.ts
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';

export default async function proxy(request: NextRequest) {
  const { session } = await withAuth();
  const user = session?.user as any;

  // Check permission from JWT
  const permissions = user?.permissions || [];

  if (path.startsWith('/admin/experts')) {
    if (!permissions.includes(WORKOS_PERMISSIONS.EXPERTS_APPROVE)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}
```

### RLS Policies

```sql
-- Permission-based policy
CREATE POLICY "Users with events:manage can manage any event"
ON events FOR ALL
USING ('events:manage' = ANY(auth.jwt_permissions()));

-- Combined: Owner OR permission
CREATE POLICY "Owner or permission can update"
ON events FOR UPDATE
USING (
  workos_user_id = auth.user_id()
  OR 'events:manage' = ANY(auth.jwt_permissions())
);

-- Role-based policy
CREATE POLICY "Admins can view all"
ON users FOR SELECT
USING (
  workos_user_id = auth.user_id()
  OR auth.jwt_role() IN ('admin', 'superadmin')
);
```

## Permission Reference

### Events

- `events:create` - Create new event types
- `events:manage` - Full event management

### Appointments

- `appointments:view` - View bookings
- `appointments:manage` - Manage bookings

### Analytics

- `analytics:advanced` - Advanced analytics (Top Expert only)

### Users

- `users:read` - View users
- `users:write` - Edit users

### Expert Management

- `experts:approve` - Approve applications (Admin)

### Platform

- `platform:configure` - Platform settings (Admin)
- `reports:access` - Access reports (Admin)

### Billing

- `billing:view` - View billing
- `billing:manage` - Manage billing

### Top Expert Features

- `branding:customize` - Custom branding
- `group_sessions:create` - Group sessions
- `messaging:direct` - Direct messaging

## Role Reference

```typescript
WORKOS_ROLES = {
  SUPERADMIN: 'superadmin', // Full system access
  ADMIN: 'admin', // Admin features
  EXPERT_TOP: 'expert_top', // Top expert (premium)
  EXPERT_COMMUNITY: 'expert_community', // Standard expert
  EXPERT_LECTURER: 'expert_lecturer', // Lecturer
  USER: 'user', // Patient/customer
};
```

## Assigning Roles

```typescript
// Via WorkOS API
// Via helper function
import { assignRoleToUser } from '@/lib/integrations/workos/assign-role';
import { workos } from '@/lib/integrations/workos/client';
import { WORKOS_ROLES } from '@/types/workos-rbac';

await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: membership.id,
  roleSlug: 'expert_top', // Defined in WorkOS Dashboard
});

await assignRoleToUser(userId, orgId, WORKOS_ROLES.EXPERT_TOP);
```

## Debugging

### Check JWT Contents

```typescript
// Server-side
import { getCurrentUser } from '@/lib/integrations/workos/rbac';

const user = await getCurrentUser();
console.log('Role:', user?.role);
console.log('Permissions:', user?.permissions);
```

### Check RLS Policy

```sql
-- In Neon SQL Editor (as authenticated user)

-- View current JWT claims
SELECT current_setting('request.jwt.claims', true)::jsonb;

-- Extract permissions
SELECT auth.jwt_permissions();

-- Extract role
SELECT auth.jwt_role();

-- Test query with RLS
SELECT * FROM events; -- Should respect RLS policies
```

### Test Permission Check

```typescript
// In browser console (logged in)
fetch('/api/user/rbac')
  .then((r) => r.json())
  .then((data) => console.log(data.user));

// Should show:
// {
//   id: "user_01H...",
//   email: "user@example.com",
//   role: "expert_top",
//   permissions: ["events:create", "events:manage", ...]
// }
```

## Common Issues

### "Permission not found in JWT"

**Cause**: Permission not assigned to role in WorkOS Dashboard

**Fix**:

1. Go to WorkOS Dashboard → RBAC → Roles
2. Select the role
3. Add the missing permission
4. User must sign out and sign in again for new JWT

### "Role not updating after assignment"

**Cause**: JWT still has old role (not expired yet)

**Fix**: User must sign out and sign in to get new JWT with updated role

### "RLS policy not working"

**Cause**: JWT function returns null or empty array

**Fix**:

```sql
-- Check JWT extraction
SELECT current_setting('request.jwt.claims', true)::jsonb;

-- If null, check Neon Auth configuration
SELECT auth.verify_jwt_config();
```

### "Can't assign role via API"

**Cause**: User not a member of organization

**Fix**: Ensure user has organization membership first

```typescript
// Create membership if needed
await workos.userManagement.createOrganizationMembership({
  userId,
  organizationId,
  roleSlug: 'user',
});
```

## Performance Tips

1. **Cache user info**: Use `cache()` from React for server functions
2. **Minimize JWT extractions**: Call `getCurrentUser()` once per request
3. **Use RLS**: Let database filter data instead of application code
4. **Index JWT functions**: Create indexes on JWT extraction functions

```sql
-- Add index for better RLS performance
CREATE INDEX CONCURRENTLY idx_jwt_permissions
ON events ((auth.jwt_permissions()));
```

## Migration Checklist

- [ ] Configure roles in WorkOS Dashboard
- [ ] Configure permissions in WorkOS Dashboard
- [ ] Map permissions to roles
- [ ] Update types (WorkOSRole, WorkOSPermission)
- [ ] Create new RBAC utilities
- [ ] Update server components
- [ ] Update API routes
- [ ] Update client components
- [ ] Update middleware
- [ ] Update RLS policies
- [ ] Run migration script
- [ ] Test thoroughly
- [ ] Deploy to production
- [ ] Remove old code

## Links

- [Full Review](./WORKOS-RBAC-NEON-RLS-REVIEW.md)
- [Implementation Guide](./WORKOS-RBAC-IMPLEMENTATION-GUIDE.md)
- [WorkOS RBAC Docs](https://workos.com/docs/rbac)
- [Neon Auth Docs](https://neon.tech/docs/guides/neon-authorize)
