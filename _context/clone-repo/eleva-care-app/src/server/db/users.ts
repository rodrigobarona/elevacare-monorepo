/**
 * User Database Queries
 *
 * Canonical location for all user lookups by WorkOS ID, username, etc.
 * Uses Drizzle ORM with Neon Postgres.
 */
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { eq, isNull } from 'drizzle-orm';

const { logger } = Sentry;

/**
 * Minimal user type for public profiles
 *
 * Note: firstName/lastName removed (Phase 5)
 * - For legal name: Fetch from WorkOS API using getWorkOSUser()
 * - For public display name: Use ProfilesTable.firstName/lastName
 */
export type MinimalUser = {
  id: string;
  workosUserId: string;
  email: string;
  username: string | null;
  imageUrl: string | null;
  role: string;
};

export async function getUserByUsername(username: string): Promise<MinimalUser | null> {
  try {
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.username, username.toLowerCase()),
      columns: {
        id: true,
        workosUserId: true,
        email: true,
        username: true,
        imageUrl: true,
        role: true,
      },
    });

    return user || null;
  } catch (error) {
    logger.error('Error fetching user by username', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Minimal user lookup by WorkOS ID (selected columns only).
 */
export async function getUserByWorkosId(workosUserId: string): Promise<MinimalUser | null> {
  try {
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
      columns: {
        id: true,
        workosUserId: true,
        email: true,
        username: true,
        imageUrl: true,
        role: true,
      },
    });

    return user || null;
  } catch (error) {
    logger.error('Error fetching user by WorkOS ID', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Full user record by WorkOS ID (all columns).
 */
export async function getFullUserByWorkosId(workosUserId: string) {
  if (!workosUserId) return null;

  try {
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    return user ?? null;
  } catch (error) {
    logger.error('Error fetching full user by WorkOS ID', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const existing = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.username, username.toLowerCase()),
      columns: { id: true },
    });

    return !existing;
  } catch (error) {
    logger.error('Error checking username availability', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function updateUsername(workosUserId: string, username: string): Promise<boolean> {
  try {
    await db
      .update(UsersTable)
      .set({
        username: username.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(UsersTable.workosUserId, workosUserId));

    return true;
  } catch (error) {
    logger.error('Error updating username', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function getUsersWithoutUsernames(limit: number = 100): Promise<MinimalUser[]> {
  try {
    const users = await db.query.UsersTable.findMany({
      where: isNull(UsersTable.username),
      limit,
      columns: {
        id: true,
        workosUserId: true,
        email: true,
        username: true,
        imageUrl: true,
        role: true,
      },
    });

    return users as MinimalUser[];
  } catch (error) {
    logger.error('Error fetching users without usernames', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}
