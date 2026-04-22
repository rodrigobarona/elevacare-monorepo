import * as Sentry from '@sentry/nextjs';
import { hasRole } from '@/lib/auth/roles.server';

const { logger } = Sentry;
import { verifyExpertConnectAccount } from '@/server/actions/experts';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';



export async function POST() {
  try {
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify if the user is an expert
    const isExpert = (await hasRole('expert_top')) || (await hasRole('expert_community'));

    if (!isExpert) {
      return NextResponse.json(
        { error: 'Only experts can verify their Connect account' },
        { status: 403 },
      );
    }

    const result = await verifyExpertConnectAccount(userId);

    if (result.error) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error in verify-connect endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
