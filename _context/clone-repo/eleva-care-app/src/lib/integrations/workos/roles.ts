/**
 * WorkOS Role Management Utilities
 *
 * Hybrid role system:
 * - Application roles from database (UsersTable.role)
 * - Organization roles from WorkOS (UserOrgMembershipsTable.role)
 *
 * Benefits:
 * - Fast queries (no WorkOS API calls)
 * - Type-safe role checking
 * - Supports both application and org roles
 * - Cached for request duration
 */
import { db } from '@/drizzle/db';
import { UserOrgMembershipsTable, UsersTable } from '@/drizzle/schema';
import type { ApplicationRole, OrganizationRole, Role } from '@/types/roles';
import { getRoleLevel, isExpertRole } from '@/types/roles';
import { eq } from 'drizzle-orm';
import { cache } from 'react';

/**
 * Get all roles for a user (application + organization)
 *
 * Returns both the user's application role (from database) and their
 * organization membership roles (from WorkOS, cached in database).
 *
 * @param workosUserId - WorkOS user ID
 * @returns Array of role slugs
 *
 * @example
 * ```ts
 * const roles = await getUserRoles('user_01H...');
 * // Returns: ['expert_top', 'owner']
 * ```
 */
export async function getUserRoles(workosUserId: string): Promise<string[]> {
  try {
    // Fetch user's application role
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
      columns: {
        role: true,
      },
    });

    // Fetch user's organization memberships
    const memberships = await db.query.UserOrgMembershipsTable.findMany({
      where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
      columns: {
        role: true,
      },
    });

    const roles: string[] = [];

    // Add application role
    if (user?.role) {
      roles.push(user.role);
    }

    // Add organization roles
    memberships.forEach((membership) => {
      if (membership.role && !roles.includes(membership.role)) {
        roles.push(membership.role);
      }
    });

    // Default to 'user' if no roles found
    return roles.length > 0 ? roles : ['user'];
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return ['user']; // Fail gracefully with default role
  }
}

/**
 * Cached version of getUserRoles for request duration
 *
 * Use this in Server Components to avoid redundant database queries
 * within the same request.
 */
export const getCachedUserRoles = cache(getUserRoles);

/**
 * Check if user has a specific role
 *
 * @param workosUserId - WorkOS user ID
 * @param role - Role to check for
 * @returns True if user has the role
 *
 * @example
 * ```ts
 * const isTopExpert = await hasRole('user_01H...', 'expert_top');
 * if (isTopExpert) {
 *   // Show expert features
 * }
 * ```
 */
export async function hasRole(workosUserId: string, role: Role): Promise<boolean> {
  const roles = await getUserRoles(workosUserId);
  return roles.includes(role);
}

/**
 * Check if user has ANY of the specified roles
 *
 * @param workosUserId - WorkOS user ID
 * @param roles - Array of roles to check
 * @returns True if user has at least one of the roles
 *
 * @example
 * ```ts
 * const isAnyExpert = await hasAnyRole('user_01H...', [
 *   'expert_top',
 *   'expert_community',
 *   'expert_lecturer'
 * ]);
 * ```
 */
export async function hasAnyRole(workosUserId: string, roles: Role[]): Promise<boolean> {
  const userRoles = await getUserRoles(workosUserId);
  return roles.some((role) => userRoles.includes(role));
}

/**
 * Check if user has ALL of the specified roles
 *
 * @param workosUserId - WorkOS user ID
 * @param roles - Array of roles to check
 * @returns True if user has all the roles
 *
 * @example
 * ```ts
 * const hasAll = await hasAllRoles('user_01H...', ['expert_top', 'owner']);
 * ```
 */
export async function hasAllRoles(workosUserId: string, roles: Role[]): Promise<boolean> {
  const userRoles = await getUserRoles(workosUserId);
  return roles.every((role) => userRoles.includes(role));
}

/**
 * Check if user is an expert (any expert role)
 *
 * @param workosUserId - WorkOS user ID
 * @returns True if user has any expert role
 *
 * @example
 * ```ts
 * const isExpert = await isUserExpert('user_01H...');
 * if (isExpert) {
 *   // Show expert dashboard
 * }
 * ```
 */
export async function isUserExpert(workosUserId: string): Promise<boolean> {
  const roles = await getUserRoles(workosUserId);
  return roles.some(isExpertRole);
}

/**
 * Check if user is an admin (admin or superadmin)
 *
 * @param workosUserId - WorkOS user ID
 * @returns True if user is an admin
 *
 * @example
 * ```ts
 * const isAdmin = await isUserAdmin('user_01H...');
 * if (isAdmin) {
 *   // Show admin panel
 * }
 * ```
 */
export async function isUserAdmin(workosUserId: string): Promise<boolean> {
  return await hasAnyRole(workosUserId, ['admin', 'superadmin']);
}

/**
 * Check if user has permission based on role hierarchy
 *
 * Checks if user's highest role level meets or exceeds the required level.
 *
 * @param workosUserId - WorkOS user ID
 * @param requiredRole - Minimum required role
 * @returns True if user has sufficient permissions
 *
 * @example
 * ```ts
 * // Check if user has at least expert_community level
 * const canAccessExpertFeatures = await hasPermission('user_01H...', 'expert_community');
 * // Returns true for expert_community, expert_lecturer, expert_top, admin, superadmin
 * ```
 */
export async function hasPermission(
  workosUserId: string,
  requiredRole: ApplicationRole,
): Promise<boolean> {
  const roles = await getUserRoles(workosUserId);
  const requiredLevel = getRoleLevel(requiredRole);

  // Check if any of user's roles meet or exceed required level
  return roles.some((role) => getRoleLevel(role) >= requiredLevel);
}

/**
 * Get user's application role (from database)
 *
 * @param workosUserId - WorkOS user ID
 * @returns Application role or 'user' as default
 *
 * @example
 * ```ts
 * const appRole = await getUserApplicationRole('user_01H...');
 * // Returns: 'expert_top' or 'user'
 * ```
 */
export async function getUserApplicationRole(workosUserId: string): Promise<ApplicationRole> {
  try {
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
      columns: {
        role: true,
      },
    });

    return (user?.role as ApplicationRole) || 'user';
  } catch (error) {
    console.error('Error fetching user application role:', error);
    return 'user';
  }
}

/**
 * Get user's organization roles
 *
 * @param workosUserId - WorkOS user ID
 * @returns Array of organization roles
 *
 * @example
 * ```ts
 * const orgRoles = await getUserOrganizationRoles('user_01H...');
 * // Returns: ['owner', 'member']
 * ```
 */
export async function getUserOrganizationRoles(workosUserId: string): Promise<OrganizationRole[]> {
  try {
    const memberships = await db.query.UserOrgMembershipsTable.findMany({
      where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
      columns: {
        role: true,
      },
    });

    return memberships.map((m) => m.role as OrganizationRole).filter(Boolean);
  } catch (error) {
    console.error('Error fetching organization roles:', error);
    return [];
  }
}

/**
 * Update user's application role
 *
 * Note: Organization roles should be managed via WorkOS API.
 *
 * @param workosUserId - WorkOS user ID
 * @param role - New application role
 *
 * @example
 * ```ts
 * await updateUserRole('user_01H...', 'expert_top');
 * ```
 */
export async function updateUserRole(workosUserId: string, role: ApplicationRole): Promise<void> {
  try {
    await db.update(UsersTable).set({ role }).where(eq(UsersTable.workosUserId, workosUserId));
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('Failed to update user role');
  }
}
