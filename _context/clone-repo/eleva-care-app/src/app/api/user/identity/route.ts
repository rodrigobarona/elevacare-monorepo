import { getIdentityVerificationStatus } from '@/lib/integrations/stripe/identity';
import { ensureFullUserSynchronization } from '@/server/actions/user-sync';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// Mark route as dynamic

export async function GET() {
  let workosUserId: string | null = null;

  try {
    const { user: authUser } = await withAuth();
    workosUserId = authUser?.id || null;
    logger.info('Auth check result', { userId: workosUserId, hasId: !!workosUserId });

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use our synchronization service to ensure all systems are in sync
    const user = await ensureFullUserSynchronization(authUser.id);

    if (!user) {
      logger.error('Failed to synchronize user', { workosUserId: authUser.id });
      return NextResponse.json({ error: 'User synchronization failed' }, { status: 500 });
    }

    // Get Identity verification status if available
    let verificationStatus = null;
    if (user.stripeIdentityVerificationId) {
      try {
        verificationStatus = await getIdentityVerificationStatus(user.stripeIdentityVerificationId);
        logger.info('Retrieved verification status', {
          verificationId: user.stripeIdentityVerificationId,
          status: verificationStatus.status,
        });
      } catch (stripeError) {
        logger.error('Error retrieving Stripe Identity verification status', { error: stripeError });
        // Return unverified status if we encounter an error
        verificationStatus = {
          status: 'error',
          lastUpdated: new Date().toISOString(),
          error: 'Failed to retrieve verification status from Stripe',
        };
      }
    } else {
      // If no verification ID exists, return unverified status
      verificationStatus = {
        status: 'unverified',
        lastUpdated: null,
      };
      logger.info('No verification ID found for user', { userId: user.id });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        stripeIdentityVerificationId: user.stripeIdentityVerificationId,
        verified: user.stripeIdentityVerified,
      },
      verificationStatus,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error in user identity API', {
      error,
      workosUserId,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
