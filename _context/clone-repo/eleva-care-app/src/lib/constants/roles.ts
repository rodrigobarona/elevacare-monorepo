/**
 * Route Patterns for Proxy Middleware RBAC
 *
 * This file defines route patterns for role-based access control in the proxy middleware.
 * Uses glob patterns like `/admin(.*)` for path matching.
 *
 * **For role and permission definitions, use:**
 * - `@/types/workos-rbac.ts` - WorkOS RBAC roles and permissions
 *
 * @see src/types/workos-rbac.ts - WorkOS role and permission definitions
 * @see src/proxy.ts - Middleware that uses these route patterns
 * @see src/lib/constants/routes.ts - Segment-based route helpers
 */

/**
 * Admin routes - require admin role (WORKOS_ROLES.SUPERADMIN)
 *
 * Access is verified in proxy.ts using JWT role claims.
 */
export const ADMIN_ROUTES = [
  // Admin pages
  '/admin(.*)',

  // Admin API endpoints
  '/api/admin(.*)',
  '/api/categories(.*)', // Category management (admin only)
] as const;

/**
 * Expert routes - require expert role (EXPERT_COMMUNITY or EXPERT_TOP)
 *
 * Access is verified in proxy.ts using JWT role claims.
 */
export const EXPERT_ROUTES = [
  // Expert pages
  '/booking(.*)',
  '/appointments(.*)',
  '/account/identity(.*)',
  '/account/billing(.*)',

  // Expert API endpoints
  '/api/expert(.*)',
  '/api/appointments(.*)',
  '/api/customers(.*)', // Customer management
  '/api/records(.*)', // Medical records
  '/api/meetings(.*)', // Meeting management
  '/api/stripe(.*)', // Stripe Connect operations
] as const;

/**
 * Special auth routes - use custom authentication (not AuthKit)
 *
 * These routes bypass AuthKit middleware but have their own security:
 * - Cron jobs: QStash signature verification in route handlers
 */
export const SPECIAL_AUTH_ROUTES = [
  '/api/cron(.*)', // Cron jobs (verified via QStash signatures)
] as const;
