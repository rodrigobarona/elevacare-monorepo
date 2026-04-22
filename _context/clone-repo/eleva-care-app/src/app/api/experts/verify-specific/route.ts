import * as Sentry from '@sentry/nextjs';
import { hasRole } from '@/lib/auth/roles.server';

const { logger } = Sentry;
import { verifyAndUpdateSpecificExpert } from '@/server/actions/experts';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';



export async function POST(req: NextRequest) {
  try {
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify if the user is an admin (superadmin in WorkOS RBAC)
    const isAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can verify other experts' }, { status: 403 });
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await verifyAndUpdateSpecificExpert(email);

    if (result.error) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error in verify-specific endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
