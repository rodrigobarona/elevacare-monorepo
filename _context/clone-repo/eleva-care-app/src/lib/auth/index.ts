/**
 * Authentication & Authorization Module
 *
 * Provides role-based access control utilities.
 *
 * Note: Admin authorization is handled by the proxy middleware (src/proxy.ts).
 * All /api/admin/* routes are protected at the middleware level.
 */

// Client-side role utilities
export * from './roles';

// Server-side role utilities
export {
  hasRole,
  hasAnyRole,
  checkRoles,
  getUserRole,
  getUserRolesFromDB,
  isAdmin,
  isExpert,
  isTopExpert,
  isCommunityExpert,
  updateUserRole,
} from './roles.server';
