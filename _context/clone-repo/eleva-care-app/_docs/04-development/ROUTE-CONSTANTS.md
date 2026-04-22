# Route Constants Architecture

> This document explains the route constant files and their purposes in the Eleva Care application.

## File Overview

| File | Purpose |
|------|---------|
| `src/lib/constants/roles.ts` | Route patterns for proxy middleware (glob syntax) |
| `src/lib/constants/routes.ts` | Segment-based route helpers and static patterns |
| `src/types/workos-rbac.ts` | WorkOS role and permission definitions |

## src/lib/constants/roles.ts

**Purpose:** Route patterns for RBAC in the proxy middleware.

### Route Patterns

Uses glob syntax for path matching:
- `/admin(.*)` → matches `/admin` and `/admin/anything`
- `/api/webhooks/stripe(.*)` → matches all Stripe webhook routes

```typescript
// Admin routes - require SUPERADMIN role
export const ADMIN_ROUTES = [
  '/admin(.*)',
  '/api/admin(.*)',
  '/api/categories(.*)',
] as const;

// Expert routes - require EXPERT_TOP or EXPERT_COMMUNITY role
export const EXPERT_ROUTES = [
  '/booking(.*)',
  '/appointments(.*)',
  '/account/identity(.*)',
  '/account/billing(.*)',
  '/api/expert(.*)',
  '/api/appointments(.*)',
  '/api/customers(.*)',
  '/api/records(.*)',
  '/api/meetings(.*)',
  '/api/stripe(.*)',
] as const;

// Special auth routes - bypass AuthKit, use custom auth
export const SPECIAL_AUTH_ROUTES = [
  '/api/cron(.*)',
] as const;
```

### Usage

```typescript
import { ADMIN_ROUTES, EXPERT_ROUTES, SPECIAL_AUTH_ROUTES } from '@/lib/constants/roles';

// In proxy.ts
if (matchPatternsArray(path, ADMIN_ROUTES)) {
  // Check admin role
}
```

## src/lib/constants/routes.ts

**Purpose:** Segment-based route helpers and static file patterns.

### Key Exports

#### `PRIVATE_ROUTE_SEGMENTS`

First path segments that require authentication:

```typescript
export const PRIVATE_ROUTE_SEGMENTS = [
  'dashboard',
  'setup',
  'account',
  'appointments',
  'booking',
  'admin',
  'partner',
] as const;
```

#### `SKIP_AUTH_API_PATTERNS`

API routes that bypass authentication (have their own security):

```typescript
export const SKIP_AUTH_API_PATTERNS = [
  '/api/webhooks/',
  '/api/cron/',
  '/api/qstash/',
  '/api/internal/',
  '/api/healthcheck',
  '/api/health/',
  '/api/create-payment-intent',
  '/api/og/',
  '/api/search',
  '/monitoring',
  '/llms-full.txt',
  '/llms.mdx/',
] as const;
```

#### `STATIC_FILE_PATTERNS`

Patterns for static files that bypass middleware:

```typescript
export const STATIC_FILE_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot|css|js|map)$/,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/_next\//,
  /^\/\.well-known\//,
] as const;
```

**Note:** `.txt` and `.mdx` are NOT in this list because they can be routes (LLM docs).

### Helper Functions

#### `isPrivateSegment(segment)`

Check if a path segment requires authentication:

```typescript
isPrivateSegment('dashboard') // true
isPrivateSegment('about')     // false
```

#### `isPublicApiPath(path)`

Check if an API path should skip authentication:

```typescript
isPublicApiPath('/api/webhooks/stripe') // true
isPublicApiPath('/api/expert/profile')  // false
```

#### `isStaticFilePath(path)`

Check if a path is a static file:

```typescript
isStaticFilePath('/logo.png')     // true
isStaticFilePath('/llms-full.txt') // false (it's a route)
```

#### `getSeoRedirect(path)`

Get SEO redirect destination for old URLs:

```typescript
getSeoRedirect('/help-guides/article') // '/docs/patient/article'
```

## src/types/workos-rbac.ts

**Purpose:** WorkOS role and permission definitions.

### Roles

```typescript
export const WORKOS_ROLES = {
  PATIENT: 'patient',
  EXPERT_COMMUNITY: 'expert_community',
  EXPERT_TOP: 'expert_top',
  SUPERADMIN: 'superadmin',
} as const;

export type WorkOSRole = typeof WORKOS_ROLES[keyof typeof WORKOS_ROLES];
```

### Role Groups

```typescript
// All admin roles (for authorization checks)
export const ADMIN_ROLES = [WORKOS_ROLES.SUPERADMIN] as const;

// All expert roles
export const EXPERT_ROLES = [
  WORKOS_ROLES.EXPERT_COMMUNITY,
  WORKOS_ROLES.EXPERT_TOP,
] as const;
```

### Role Hierarchy

```typescript
export const WORKOS_ROLE_HIERARCHY: Record<WorkOSRole, number> = {
  [WORKOS_ROLES.PATIENT]: 1,
  [WORKOS_ROLES.EXPERT_COMMUNITY]: 2,
  [WORKOS_ROLES.EXPERT_TOP]: 3,
  [WORKOS_ROLES.SUPERADMIN]: 4,
};
```

### Permissions

```typescript
export const WORKOS_PERMISSIONS = {
  // Patient permissions
  BOOK_APPOINTMENT: 'book:appointment',
  VIEW_OWN_RECORDS: 'view:own_records',
  
  // Expert permissions
  MANAGE_APPOINTMENTS: 'manage:appointments',
  VIEW_PATIENT_RECORDS: 'view:patient_records',
  MANAGE_AVAILABILITY: 'manage:availability',
  
  // Admin permissions
  MANAGE_USERS: 'manage:users',
  MANAGE_CATEGORIES: 'manage:categories',
  VIEW_ANALYTICS: 'view:analytics',
  MANAGE_SYSTEM: 'manage:system',
} as const;
```

### Usage

```typescript
import { WORKOS_ROLES, ADMIN_ROLES, type WorkOSRole } from '@/types/workos-rbac';

// Check if user is admin
if (userRole === WORKOS_ROLES.SUPERADMIN) {
  // Admin access
}

// Check role groups
import { hasRequiredRole } from '@/proxy';
if (hasRequiredRole(userRole, ADMIN_ROLES)) {
  // Has admin-level access
}
```

## Best Practices

### Adding New Routes

1. **Protected route?** Add to `ADMIN_ROUTES` or `EXPERT_ROUTES` in `roles.ts`
2. **Skip auth?** Add to `SKIP_AUTH_API_PATTERNS` in `routes.ts`
3. **New segment?** Add to `PRIVATE_ROUTE_SEGMENTS` in `routes.ts`

### Adding New Roles

1. Add to `WORKOS_ROLES` in `workos-rbac.ts`
2. Add to role groups (`ADMIN_ROLES`, `EXPERT_ROLES`) if applicable
3. Update `WORKOS_ROLE_HIERARCHY` with priority
4. Configure in WorkOS dashboard

### Testing Routes

```bash
# Test public route
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/about

# Test protected route (should redirect)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard

# Test skip-auth route
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/webhooks/stripe

# Test LLM route
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/llms-full.txt
```

## Migration Notes

### From Legacy Roles

The old role system (`ROLE_USER`, `ROLE_ADMIN`, etc.) has been replaced with WorkOS RBAC:

| Old | New |
|-----|-----|
| `ROLE_USER` | `WORKOS_ROLES.PATIENT` |
| `ROLE_COMMUNITY_EXPERT` | `WORKOS_ROLES.EXPERT_COMMUNITY` |
| `ROLE_TOP_EXPERT` | `WORKOS_ROLES.EXPERT_TOP` |
| `ROLE_ADMIN` | `WORKOS_ROLES.SUPERADMIN` |
| `ROLE_SUPERADMIN` | `WORKOS_ROLES.SUPERADMIN` |

**Note:** The old `ROLE_ADMIN` and `ROLE_SUPERADMIN` are now combined into `SUPERADMIN`.

