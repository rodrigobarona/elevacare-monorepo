import { db } from '@/drizzle/db';
import { getUserByUsername } from '@/server/db/users';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

interface ProfileAccessControlProps {
  username: string;
  children: ReactNode;
  /**
   * Optional context for logging purposes (e.g., "BookEventPage", "SuccessPage")
   */
  context?: string;
  /**
   * Optional additional path info for logging (e.g., eventSlug)
   */
  additionalPath?: string;
}

/**
 * ProfileAccessControl Component
 *
 * Centralized access control for profile-based pages. This component:
 * 1. Fetches user data by username
 * 2. Checks if the profile is published
 * 3. If not published, only allows access to the profile owner
 * 4. Returns 404 for unauthorized access
 * 5. Renders children if access is granted
 *
 * @param username - The username from the URL params
 * @param children - The content to render if access is granted
 * @param context - Optional context for logging (e.g., "BookEventPage")
 * @param additionalPath - Optional additional path info for logging (e.g., eventSlug)
 */
export async function ProfileAccessControl({
  username,
  children,
  context = 'ProfileAccessControl',
  additionalPath = '',
}: ProfileAccessControlProps) {
  // Fetch user data
  const user = await getUserByUsername(username);

  if (!user) {
    console.log(`[${context}] User not found for username: ${username}`);
    return notFound();
  }

  // Get profile data to check published status
  const profile = await db.query.ProfilesTable.findFirst({
    where: ({ workosUserId }, { eq }) => eq(workosUserId, user.workosUserId),
  });

  // Check if profile is published
  if (!profile?.published) {
    const pathInfo = additionalPath ? `/${additionalPath}` : '';
    console.log(`[${context}] Profile not published for username: ${username}`);

    // Get current authenticated user
    const { user: currentUser } = await withAuth();

    // If profile is not published, only allow access to the profile owner
    if (!currentUser || currentUser.id !== user.workosUserId) {
      console.log(
        `[${context}] Unauthorized access to unpublished profile: ${username}${pathInfo}`,
      );
      return notFound();
    }

    console.log(
      `[${context}] Profile owner accessing their own unpublished profile: ${username}${pathInfo}`,
    );
  }

  // Access granted - render children with user data available via context if needed
  return <>{children}</>;
}

/**
 * Hook-style utility function for getting user and profile data
 * Use this when you need the user/profile data in your component logic
 */
export async function getProfileAccessData(username: string) {
  const user = await getUserByUsername(username);

  if (!user) {
    return null;
  }

  const profile = await db.query.ProfilesTable.findFirst({
    where: ({ workosUserId }, { eq }) => eq(workosUserId, user.workosUserId),
  });

  return { user, profile };
}

/**
 * Utility function to check access without rendering
 * Returns true if access should be granted, false otherwise
 */
export async function checkProfileAccess(username: string): Promise<boolean> {
  try {
    const data = await getProfileAccessData(username);
    if (!data) return false;

    const { user, profile } = data;

    // If profile is published, access is granted
    if (profile?.published) return true;

    // If not published, check if current user is the profile owner
    const { user: currentUser } = await withAuth();
    return currentUser?.id === user.workosUserId;
  } catch (error) {
    console.error('Error checking profile access:', error);
    return false;
  }
}
