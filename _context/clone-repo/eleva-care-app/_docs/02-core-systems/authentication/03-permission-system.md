# Permission System

This document explains the current authorization approach in the Eleva Care application and outlines future plans for a more granular permission system.

## Current Implementation: Role-Based Access Control

Currently, the application uses a straightforward role-based access control (RBAC) system, where access to features and resources is determined by a user's role or roles.

### Available Roles

All roles and route definitions are centrally defined in `/lib/constants/roles.ts`:

```typescript
// Individual Role Names
export const ROLE_USER = 'user' as const;
export const ROLE_TOP_EXPERT = 'top_expert' as const;
export const ROLE_COMMUNITY_EXPERT = 'community_expert' as const;
export const ROLE_LECTURER = 'lecturer' as const;
export const ROLE_ADMIN = 'admin' as const;
export const ROLE_SUPERADMIN = 'superadmin' as const;

// Type definitions (from lib/auth/roles.ts)
type UserRole =
  | typeof ROLE_USER
  | typeof ROLE_TOP_EXPERT
  | typeof ROLE_COMMUNITY_EXPERT
  | typeof ROLE_LECTURER
  | typeof ROLE_ADMIN
  | typeof ROLE_SUPERADMIN;
```

These constants are imported where needed to ensure consistency and prevent typos.

### Role-Based Access

Each role grants access to specific parts of the application:

- **Superadmin** (`ROLE_SUPERADMIN`): Complete system access with ability to assign any role
- **Admin** (`ROLE_ADMIN`): Administrative access to manage users, experts, content, and view reports
- **Top Expert** (`ROLE_TOP_EXPERT`): Full expert capabilities, including premium features
- **Community Expert** (`ROLE_COMMUNITY_EXPERT`): Standard expert capabilities
- **Lecturer** (`ROLE_LECTURER`): Access to create and manage educational content
- **User (Customer)** (`ROLE_USER`): Basic access to use the platform services

Access control is implemented through:

- Server-side role checks using helpers from `lib/auth/roles.server.ts`
- Client-side conditional rendering with hooks
- Middleware route protection using route patterns from `lib/constants/roles.ts`

## Future Enhancement: Granular Permission System

In future releases, we plan to implement a more granular permission system to provide finer control over user capabilities.

### Planned Permission Structure

Permissions will follow a resource-action pattern:

```
[resource]:[action]
```

Examples:

- `events:create` - Allows creating events
- `users:view` - Allows viewing user details
- `users:manage` - Allows full management of users
- `billing:access` - Allows access to billing information

### Planned Permission Sets

Each role will have a predefined set of permissions:

#### Superadmin

- All permissions (system-wide access)

#### Admin

- `users:view`, `users:edit`
- `experts:manage`
- `events:manage`
- `billing:view`
- `reports:access`

#### Top Expert

- `appointments:manage`
- `customers:view`
- `events:create`, `events:edit`
- `profile:customize`
- `billing:access`

#### Community Expert

- `appointments:manage`
- `customers:view`
- `events:create`
- `profile:basic`

#### Lecturer

- `content:create`
- `content:manage`
- `profile:basic`

#### User

- `appointments:book`
- `profile:view`
- `content:access`

### Planned Implementation

The permission system will extend the current role-based system with:

1. **Permission Storage**:
   - Permissions stored in a database table
   - Role-permission mappings in a join table

2. **Permission Checks**:
   - Server helpers: `hasPermission(permission)`, `hasAnyPermission([permissions])`
   - Client hooks: `useHasPermission(permission)`

3. **UI Components**:

   ```tsx
   // Import permission constants (future)
   import { PERM_USERS_EDIT } from '@/lib/constants/permissions';

   <RequirePermission permission={PERM_USERS_EDIT}>
     <UserEditForm />
   </RequirePermission>;
   ```

4. **API Protection**:

   ```typescript
   // Import permission constants (future)
   import { PERM_REPORTS_ACCESS } from '@/lib/constants/permissions';

   if (!(await hasPermission(PERM_REPORTS_ACCESS))) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   }
   ```

## Migration Plan

When implementing the permission system:

1. Define all permissions and their meanings (using a similar constants approach)
2. Map existing roles to permission sets
3. Implement database schema for permissions
4. Create helper functions and React components
5. Update existing role checks to use permissions
6. Maintain backward compatibility during transition

## Benefits of Adding Permissions

1. **Granular Control**: Assign specific capabilities independent of roles
2. **Flexible Role Configuration**: Create custom roles with specific permission sets
3. **Easier Maintenance**: Change permissions without modifying code
4. **Better Auditability**: Track exactly what actions users can perform
5. **Scalability**: Support complex organizational structures

## Current Status

Until the permission system is implemented, continue using the role-based approach with the centralized constants approach. See the following guides for more information:

- [Role-Based Authorization](./role-based-authorization.md)
- [Role Management Guide](./role-management-guide.md)
- [Route Protection Guide](./route-protection-guide.md)
