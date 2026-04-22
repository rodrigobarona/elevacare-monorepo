/**
 * WorkOS RBAC Utilities
 *
 * JWT-based role and permission checking utilities.
 * Replaces the old database-based role system with zero database queries.
 *
 * Benefits:
 * - Zero database queries (reads from JWT)
 * - Type-safe permission checking
 * - Cached per request
 * - Supports role hierarchy
 *
 * @see _docs/_WorkOS RABAC implemenation/WORKOS-RBAC-IMPLEMENTATION-GUIDE.md
 */
import type { WorkOSPermission, WorkOSRole, WorkOSUserWithRBAC } from '@/types/workos-rbac';
import { WORKOS_PERMISSIONS, WORKOS_ROLE_HIERARCHY, WORKOS_ROLES } from '@/types/workos-rbac';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { cache } from 'react';

const { logger } = Sentry;

// ============================================================================
// CORE USER FUNCTIONS
// ============================================================================

/**
 * Get current user with RBAC information from JWT
 *
 * This is cached per request to avoid multiple auth checks.
 * Zero database queries - all data comes from JWT.
 *
 * @returns User with role and permissions, or null if not authenticated
 *
 * @example
 * ```ts
 * const user = await getCurrentUser();
 * if (user) {
 *   console.log('Role:', user.role);
 *   console.log('Permissions:', user.permissions);
 * }
 * ```
 */
export const getCurrentUser = cache(async (): Promise<WorkOSUserWithRBAC | null> => {
  try {
    const auth = await withAuth();

    if (!auth.user) return null;

    const { user, role, permissions, organizationId } = auth;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      profilePictureUrl: user.profilePictureUrl ?? undefined,
      // RBAC claims from JWT (UserInfo from withAuth)
      role: role as WorkOSRole | undefined,
      permissions: permissions as WorkOSPermission[] | undefined,
      // Organization context
      organizationId,
      organizationSlug: undefined, // UserInfo does not include organizationSlug
    };
  } catch (error) {
    logger.error('RBAC error getting current user', { error });
    return null;
  }
});

/**
 * Get current user's role from JWT
 *
 * @returns Role slug or 'patient' as default
 */
export async function getCurrentUserRole(): Promise<WorkOSRole> {
  const user = await getCurrentUser();
  return user?.role || WORKOS_ROLES.PATIENT;
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

// ============================================================================
// ROLE CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if current user has a specific role
 *
 * @param role - Role slug to check
 * @returns True if user has the role
 *
 * @example
 * ```ts
 * if (await hasRole(WORKOS_ROLES.EXPERT_TOP)) {
 *   // Show top expert features
 * }
 * ```
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
 *
 * @example
 * ```ts
 * if (await hasAnyRole([WORKOS_ROLES.EXPERT_TOP, WORKOS_ROLES.EXPERT_COMMUNITY])) {
 *   // Show expert features
 * }
 * ```
 */
export async function hasAnyRole(roles: WorkOSRole[]): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  return roles.includes(userRole);
}

/**
 * Check if current user's role meets or exceeds required level
 *
 * Uses role hierarchy for "at least" permission checks.
 *
 * @param requiredRole - Minimum required role
 * @returns True if user has sufficient role level
 *
 * @example
 * ```ts
 * // Returns true for expert_community, expert_top, partner_admin, superadmin
 * if (await hasRoleLevel(WORKOS_ROLES.EXPERT_COMMUNITY)) {
 *   // Show expert features
 * }
 * ```
 */
export async function hasRoleLevel(requiredRole: WorkOSRole): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  const userLevel = WORKOS_ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = WORKOS_ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

// ============================================================================
// PERMISSION CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if current user has a specific permission
 *
 * @param permission - Permission slug to check
 * @returns True if user has the permission
 *
 * @example
 * ```ts
 * if (await hasPermission(WORKOS_PERMISSIONS.ANALYTICS_VIEW)) {
 *   // Show analytics
 * }
 * ```
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
 *
 * @example
 * ```ts
 * if (await hasAllPermissions([
 *   WORKOS_PERMISSIONS.EVENTS_CREATE,
 *   WORKOS_PERMISSIONS.EVENTS_DELETE_OWN
 * ])) {
 *   // User can create and delete events
 * }
 * ```
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
 *
 * @example
 * ```ts
 * if (await hasAnyPermission([
 *   WORKOS_PERMISSIONS.EXPERTS_APPROVE,
 *   WORKOS_PERMISSIONS.EXPERTS_REJECT
 * ])) {
 *   // User can review expert applications
 * }
 * ```
 */
export async function hasAnyPermission(requiredPermissions: WorkOSPermission[]): Promise<boolean> {
  const permissions = await getCurrentUserPermissions();
  return requiredPermissions.some((perm) => permissions.includes(perm));
}

// ============================================================================
// REQUIRE FUNCTIONS (throw if not authorized)
// ============================================================================

/**
 * Require user to have specific permission (throws if not)
 *
 * Use in Server Components or API routes to guard access.
 *
 * @param permission - Permission slug required
 * @throws Error if user doesn't have permission
 *
 * @example
 * ```ts
 * export default async function AnalyticsPage() {
 *   await requirePermission(WORKOS_PERMISSIONS.ANALYTICS_VIEW);
 *   return <Analytics />;
 * }
 * ```
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

/**
 * Require user to have any of the specified roles (throws if not)
 *
 * @param roles - Array of role slugs (user needs at least one)
 * @throws Error if user doesn't have any of the roles
 */
export async function requireAnyRole(roles: WorkOSRole[]): Promise<void> {
  if (!(await hasAnyRole(roles))) {
    throw new Error(`One of these roles required: ${roles.join(', ')}`);
  }
}

/**
 * Require user to have all specified permissions (throws if not)
 *
 * @param permissions - Array of permission slugs (user needs all)
 * @throws Error if user doesn't have all permissions
 */
export async function requireAllPermissions(permissions: WorkOSPermission[]): Promise<void> {
  if (!(await hasAllPermissions(permissions))) {
    throw new Error(`All of these permissions required: ${permissions.join(', ')}`);
  }
}

// ============================================================================
// CONVENIENCE HELPER FUNCTIONS
// ============================================================================

/**
 * Check if current user is an admin (superadmin)
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.SUPERADMIN);
}

/**
 * Check if current user is a superadmin
 */
export async function isSuperAdmin(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.SUPERADMIN);
}

/**
 * Check if current user is any type of expert
 */
export async function isExpert(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === WORKOS_ROLES.EXPERT_COMMUNITY || role === WORKOS_ROLES.EXPERT_TOP;
}

/**
 * Check if current user is a top expert
 */
export async function isTopExpert(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_TOP);
}

/**
 * Check if current user is a community expert
 */
export async function isCommunityExpert(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_COMMUNITY);
}

/**
 * Check if current user is a partner member or admin
 */
export async function isPartner(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === WORKOS_ROLES.PARTNER_MEMBER || role === WORKOS_ROLES.PARTNER_ADMIN;
}

/**
 * Check if current user is a partner admin
 */
export async function isPartnerAdmin(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.PARTNER_ADMIN);
}

/**
 * Check if current user is a patient (default role)
 */
export async function isPatient(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.PATIENT);
}

// ============================================================================
// PERMISSION-BASED HELPER FUNCTIONS
// ============================================================================

/**
 * Check if current user can manage events
 */
export async function canManageEvents(): Promise<boolean> {
  return hasAllPermissions([
    WORKOS_PERMISSIONS.EVENTS_CREATE,
    WORKOS_PERMISSIONS.EVENTS_EDIT_OWN,
    WORKOS_PERMISSIONS.EVENTS_DELETE_OWN,
  ]);
}

/**
 * Check if current user can approve experts
 */
export async function canApproveExperts(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.EXPERTS_APPROVE);
}

/**
 * Check if current user can access advanced analytics
 */
export async function canAccessAdvancedAnalytics(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.ANALYTICS_VIEW);
}

/**
 * Check if current user can customize branding
 */
export async function canCustomizeBranding(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.BRANDING_CUSTOMIZE);
}

/**
 * Check if current user can manage platform settings
 */
export async function canManagePlatform(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.SETTINGS_EDIT_PLATFORM);
}

/**
 * Check if current user can manage users
 */
export async function canManageUsers(): Promise<boolean> {
  return hasAllPermissions([WORKOS_PERMISSIONS.USERS_VIEW_ALL, WORKOS_PERMISSIONS.USERS_EDIT]);
}

/**
 * Check if current user can view expert dashboard
 */
export async function canViewExpertDashboard(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.DASHBOARD_VIEW_EXPERT);
}

/**
 * Check if current user can view patient dashboard
 */
export async function canViewPatientDashboard(): Promise<boolean> {
  return hasPermission(WORKOS_PERMISSIONS.DASHBOARD_VIEW_PATIENT);
}

// ============================================================================
// SYNCHRONOUS PERMISSION CHECK (for client-side use)
// ============================================================================

/**
 * Check permission synchronously given a user object
 *
 * Use this for client-side permission checks where you already have the user.
 *
 * @param user - User object with permissions
 * @param permission - Permission to check
 * @returns True if user has permission
 */
export function checkPermission(
  user: WorkOSUserWithRBAC | null,
  permission: WorkOSPermission,
): boolean {
  if (!user?.permissions) return false;
  return user.permissions.includes(permission);
}

/**
 * Check any permissions synchronously given a user object
 *
 * @param user - User object with permissions
 * @param permissions - Permissions to check
 * @returns True if user has any of the permissions
 */
export function checkAnyPermission(
  user: WorkOSUserWithRBAC | null,
  permissions: WorkOSPermission[],
): boolean {
  if (!user?.permissions) return false;
  return permissions.some((perm) => user.permissions?.includes(perm));
}

/**
 * Check all permissions synchronously given a user object
 *
 * @param user - User object with permissions
 * @param permissions - Permissions to check
 * @returns True if user has all permissions
 */
export function checkAllPermissions(
  user: WorkOSUserWithRBAC | null,
  permissions: WorkOSPermission[],
): boolean {
  if (!user?.permissions) return false;
  return permissions.every((perm) => user.permissions?.includes(perm));
}

/**
 * Check role synchronously given a user object
 *
 * @param user - User object with role
 * @param role - Role to check
 * @returns True if user has role
 */
export function checkRole(user: WorkOSUserWithRBAC | null, role: WorkOSRole): boolean {
  if (!user?.role) return false;
  return user.role === role;
}

/**
 * Check any roles synchronously given a user object
 *
 * @param user - User object with role
 * @param roles - Roles to check
 * @returns True if user has any of the roles
 */
export function checkAnyRole(user: WorkOSUserWithRBAC | null, roles: WorkOSRole[]): boolean {
  if (!user?.role) return false;
  return roles.includes(user.role);
}
