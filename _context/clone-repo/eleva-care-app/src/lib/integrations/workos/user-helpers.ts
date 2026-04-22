/**
 * WorkOS User Management Helpers
 *
 * Helper functions to fetch user data from WorkOS User Management API.
 * Since we removed firstName/lastName from UsersTable, we fetch from WorkOS.
 */
import { workos } from '@/lib/integrations/workos/client';

export interface WorkOSUserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch user data from WorkOS User Management API
 *
 * @param workosUserId - WorkOS user ID (e.g., "user_01...")
 * @returns User data from WorkOS
 *
 * @example
 * const workosUser = await getWorkOSUser('user_01...');
 * const fullName = `${workosUser.firstName} ${workosUser.lastName}`;
 */
export async function getWorkOSUser(workosUserId: string): Promise<WorkOSUserData> {
  try {
    // workos is already imported at the top
    const user = await workos.userManagement.getUser(workosUserId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      profilePictureUrl: user.profilePictureUrl || null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    console.error(`[getWorkOSUser] Error fetching user ${workosUserId}:`, error);
    throw new Error(`Failed to fetch WorkOS user: ${workosUserId}`);
  }
}

/**
 * Get full name from WorkOS user data
 *
 * @param workosUserId - WorkOS user ID
 * @returns Full name string (e.g., "Patricia Silva")
 */
export async function getWorkOSUserFullName(workosUserId: string): Promise<string> {
  const user = await getWorkOSUser(workosUserId);
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
}

/**
 * Get multiple users from WorkOS (batch operation)
 *
 * @param workosUserIds - Array of WorkOS user IDs
 * @returns Map of user ID to user data
 */
export async function getWorkOSUsers(
  workosUserIds: string[],
): Promise<Map<string, WorkOSUserData>> {
  const results = new Map<string, WorkOSUserData>();

  await Promise.all(
    workosUserIds.map(async (id) => {
      try {
        const userData = await getWorkOSUser(id);
        results.set(id, userData);
      } catch (error) {
        console.error(`[getWorkOSUsers] Failed to fetch user ${id}:`, error);
        // Continue with other users
      }
    }),
  );

  return results;
}
