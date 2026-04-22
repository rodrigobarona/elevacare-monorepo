/**
 * User RBAC API Endpoint
 *
 * Returns the current user's RBAC information from JWT.
 * Used by RBACProvider for client-side permission checking.
 *
 * @route GET /api/user/rbac
 * @returns { user: WorkOSUserWithRBAC | null }
 */

import { getCurrentUser } from '@/lib/integrations/workos/rbac';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { user: null },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        role: user.role,
        permissions: user.permissions,
        organizationId: user.organizationId,
        organizationSlug: user.organizationSlug,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('API/user/rbac Error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

