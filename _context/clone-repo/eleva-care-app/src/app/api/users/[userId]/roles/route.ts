import { getUserRolesFromDB, hasRole, updateUserRole } from '@/lib/auth/roles.server';
import { WORKOS_ROLES, type WorkOSRole } from '@/types/workos-rbac';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

/**
 * Zod schema for validating role updates
 */
const roleSchema = z.object({
  role: z.nativeEnum(WORKOS_ROLES),
});

/**
 * GET /api/users/[userId]/roles
 *
 * Get a user's role. Users can only fetch their own role unless they are a superadmin.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  try {
    const params = await props.params;
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not authenticated' },
        { status: 401 },
      );
    }

    const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);

    // Users can only fetch their own role unless they are superadmin
    if (!isSuperAdmin && user.id !== params.userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Fetch the requested user's role
    const roles = await getUserRolesFromDB(params.userId);
    const role = roles.length > 0 ? roles[0] : WORKOS_ROLES.PATIENT;

    return NextResponse.json({ role });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching user role', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch user role' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/users/[userId]/roles
 *
 * Update a user's role. Only superadmins can update roles.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  try {
    const params = await props.params;

    // Authentication check - must be done before processing request body
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not authenticated' },
        { status: 401 },
      );
    }

    // Authorization check - only superadmins can update roles
    const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only superadmins can update user roles' },
        { status: 403 },
      );
    }

    // Parse and validate request body after auth checks pass
    const body = await request.json();
    const parseResult = roleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid or missing role',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { role } = parseResult.data;

    // Use updateUserRole (which has its own internal checks)
    await updateUserRole(params.userId, role);

    return NextResponse.json({
      success: true,
      message: `Role updated successfully to: ${role}`,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating user role', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: (error as Error).message },
      { status: 500 },
    );
  }
}
