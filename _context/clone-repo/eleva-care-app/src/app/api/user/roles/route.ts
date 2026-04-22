/**
 * GET /api/user/roles
 *
 * Returns the current user's roles from the database.
 * Used by AuthorizationProvider for client-side role checks.
 */
import { db } from '@/drizzle/db';
import { RolesTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function GET() {
  try {
    // Require authentication
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user roles from database
    const userRoles = await db.query.RolesTable.findMany({
      where: eq(RolesTable.workosUserId, user.id),
      columns: {
        role: true,
      },
    });

    // Extract role values
    const roles = userRoles.map((r) => r.role);

    // Default to 'user' if no roles found
    if (roles.length === 0) {
      return NextResponse.json({ roles: ['user'] });
    }

    return NextResponse.json({ roles });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching user roles', { error });
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}
