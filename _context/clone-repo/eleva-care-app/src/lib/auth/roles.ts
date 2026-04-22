/**
 * Client-side Role Management
 *
 * For role and permission definitions, use WorkOS RBAC:
 * @see src/types/workos-rbac.ts
 *
 * For route patterns used in proxy middleware:
 * @see src/lib/constants/roles.ts
 */
import { ADMIN_ROUTES, EXPERT_ROUTES, SPECIAL_AUTH_ROUTES } from '@/lib/constants/roles';
import {
  ADMIN_ROLES,
  EXPERT_ROLES,
  WORKOS_ROLE_HIERARCHY,
  WORKOS_ROLES,
  type WorkOSRole,
} from '@/types/workos-rbac';

// Re-export types and constants
export type { WorkOSRole };

/**
 * @deprecated Use WorkOSRole instead
 */
export type UserRole = WorkOSRole;

export { WORKOS_ROLES, ADMIN_ROLES, EXPERT_ROLES };

/**
 * All available roles for UI selection
 */
export const ROLES = Object.values(WORKOS_ROLES);

// Re-export route patterns
export { ADMIN_ROUTES, EXPERT_ROUTES, SPECIAL_AUTH_ROUTES };

// Role priority for UI purposes (matches WORKOS_ROLE_HIERARCHY)
export const ROLE_PRIORITY = WORKOS_ROLE_HIERARCHY;

/**
 * Result type for getUserRole with proper error handling
 */
export type GetUserRoleResult =
  | { success: true; role: WorkOSRole }
  | { success: false; error: string };

/**
 * Result type for updateUserRole with proper error handling
 */
export type UpdateUserRoleResult = { success: true } | { success: false; error: string };

/**
 * Client-side function to get user role with proper error handling
 */
export async function getUserRole(userId: string): Promise<GetUserRoleResult> {
  try {
    const response = await fetch(`/api/users/${userId}/roles`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.message || `Failed to fetch role: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, role: data.role };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error fetching role',
    };
  }
}

/**
 * Client-side function to update user role with structured error handling
 */
export async function updateUserRole(
  userId: string,
  role: WorkOSRole,
): Promise<UpdateUserRoleResult> {
  try {
    const response = await fetch(`/api/users/${userId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.message || 'Failed to update role' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error updating role',
    };
  }
}
