import { getUserRole } from '@/lib/auth/roles.server';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function GET() {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not authenticated' },
        { status: 401 },
      );
    }

    // Get user role
    const role = await getUserRole();

    return NextResponse.json({
      role,
    });
  } catch (error) {
    logger.error('Error fetching user authorization details', { error });
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch user authorization details' },
      { status: 500 },
    );
  }
}
