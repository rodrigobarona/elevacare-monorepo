/**
 * Server-side Role Management
 *
 * These functions should only be used in Server Components or API routes.
 *
 * For role and permission definitions, use WorkOS RBAC:
 * @see src/types/workos-rbac.ts
 */
import { db } from '@/drizzle/db';
import { RolesTable } from '@/drizzle/schema';
import { ADMIN_ROLES, EXPERT_ROLES, WORKOS_ROLES, type WorkOSRole } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';

/** Set of valid WorkOS roles for runtime validation */
const VALID_ROLES = new Set<string>(Object.values(WORKOS_ROLES));

/**
 * Get user roles from database by WorkOS user ID
 *
 * Use this when you need to fetch a specific user's roles (not the current user).
 * For current user's roles, use getUserRole() instead.
 *
 * Includes runtime validation to filter out invalid roles from database.
 */
export async function getUserRolesFromDB(workosUserId: string): Promise<WorkOSRole[]> {
  const userRoles = await db
    .select({ role: RolesTable.role })
    .from(RolesTable)
    .where(eq(RolesTable.workosUserId, workosUserId));

  // Runtime validation: filter out any invalid roles from database
  return userRoles.map((r) => r.role).filter((role): role is WorkOSRole => VALID_ROLES.has(role));
}

/**
 * Middleware helper function to check if a user has any of the specified roles
 * @param userRoles - User roles from session metadata (string, array, or undefined)
 * @param requiredRoles - Array of roles to check against
 * @returns boolean indicating if the user has any of the required roles
 */
export function checkRoles(
  userRoles: string | string[] | unknown,
  requiredRoles: readonly string[],
): boolean {
  // Handle cases where userRoles is undefined/null
  if (!userRoles) return false;

  // Convert to array if it's a string
  const rolesArray = Array.isArray(userRoles)
    ? userRoles
    : typeof userRoles === 'string'
      ? [userRoles]
      : [];

  // Convert everything to lowercase for case-insensitive comparison
  const normalizedUserRoles = rolesArray.map((r) => r.toLowerCase());
  const normalizedRequiredRoles = requiredRoles.map((r) => r.toLowerCase());

  return normalizedUserRoles.some((role) => normalizedRequiredRoles.includes(role));
}

/**
 * Check if the current user has any of the specified roles
 */
export async function hasAnyRole(roles: readonly WorkOSRole[]): Promise<boolean> {
  const { user } = await withAuth();
  if (!user) return false;

  const userRoles = await getUserRolesFromDB(user.id);

  if (userRoles.length === 0) return false;

  // Check if user has any of the required roles
  return roles.some((role) => userRoles.includes(role));
}

/**
 * Check if the current user has the specified role
 */
export async function hasRole(role: WorkOSRole): Promise<boolean> {
  const { user } = await withAuth();
  if (!user) return false;

  const userRoles = await getUserRolesFromDB(user.id);

  return userRoles.includes(role);
}

/**
 * Convenience function to check if user is an admin (superadmin or admin)
 */
export async function isAdmin(): Promise<boolean> {
  return hasAnyRole(ADMIN_ROLES);
}

/**
 * Convenience function to check if user is any type of expert
 */
export async function isExpert(): Promise<boolean> {
  return hasAnyRole(EXPERT_ROLES);
}

/**
 * Convenience function to check if user is a top expert
 */
export async function isTopExpert(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_TOP);
}

/**
 * Convenience function to check if user is a community expert
 */
export async function isCommunityExpert(): Promise<boolean> {
  return hasRole(WORKOS_ROLES.EXPERT_COMMUNITY);
}

/**
 * Role priority for determining the highest-priority role.
 * Higher index = higher priority.
 *
 * Note: If a role isn't in this array, indexOf returns -1,
 * making it lower priority than PATIENT. This is safe because
 * getUserRolesFromDB filters invalid roles via VALID_ROLES.
 */
const ROLE_PRIORITY: WorkOSRole[] = [
  WORKOS_ROLES.PATIENT,
  WORKOS_ROLES.PARTNER_MEMBER,
  WORKOS_ROLES.EXPERT_COMMUNITY,
  WORKOS_ROLES.EXPERT_TOP,
  WORKOS_ROLES.PARTNER_ADMIN,
  WORKOS_ROLES.SUPERADMIN,
];

/**
 * Get the highest-priority role from an array of roles.
 */
function getHighestPriorityRole(roles: WorkOSRole[]): WorkOSRole {
  if (roles.length === 0) return WORKOS_ROLES.PATIENT;
  if (roles.length === 1) return roles[0];

  // Find the role with the highest priority index
  let highestRole = roles[0];
  let highestPriority = ROLE_PRIORITY.indexOf(highestRole);

  for (const role of roles) {
    const priority = ROLE_PRIORITY.indexOf(role);
    if (priority > highestPriority) {
      highestPriority = priority;
      highestRole = role;
    }
  }

  return highestRole;
}

/**
 * Get the current user's role (single highest-priority role).
 * Always returns a single WorkOSRole for consistency with client-side.
 */
export async function getUserRole(): Promise<WorkOSRole> {
  const { user } = await withAuth();
  if (!user) return WORKOS_ROLES.PATIENT;

  const userRoles = await getUserRolesFromDB(user.id);

  if (userRoles.length === 0) return WORKOS_ROLES.PATIENT;

  return getHighestPriorityRole(userRoles);
}

/**
 * Update a user's role (requires admin/superadmin)
 */
export async function updateUserRole(workosUserId: string, role: WorkOSRole): Promise<void> {
  const { user: currentUser } = await withAuth();
  if (!currentUser) throw new Error('Unauthorized');

  // Check if current user has permission to update roles
  const currentUserRoles = await getUserRolesFromDB(currentUser.id);

  const isSuperAdmin = currentUserRoles.includes(WORKOS_ROLES.SUPERADMIN);

  if (!isSuperAdmin) {
    throw new Error('Insufficient permissions - only superadmins can update roles');
  }

  // Use a transaction to ensure atomic delete+insert
  // This prevents leaving the user without roles if insert fails
  await db.transaction(async (tx) => {
    // Delete existing roles for this user
    await tx.delete(RolesTable).where(eq(RolesTable.workosUserId, workosUserId));

    // Insert new role
    await tx.insert(RolesTable).values({
      workosUserId,
      role,
    });
  });
}
