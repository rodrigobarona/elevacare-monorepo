import { getServerStripe } from '@/lib/integrations/stripe';
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// Mark route as dynamic

/**
 * This endpoint forces a verification status update for a user's Stripe Connect account.
 * It should only be used by administrators to fix accounts that are stuck in an inconsistent state.
 *
 * Required:
 * - Header: Authorization: Bearer <INTERNAL_ADMIN_KEY>
 * - Query parameter: workosUserId - The WorkOS user ID of the user
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (
      !process.env.INTERNAL_ADMIN_KEY ||
      authHeader !== `Bearer ${process.env.INTERNAL_ADMIN_KEY}`
    ) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const url = new URL(request.url);
    const workosUserId = url.searchParams.get('workosUserId');

    if (!workosUserId) {
      return NextResponse.json({ error: 'Missing workosUserId parameter' }, { status: 400 });
    }

    // Verify this is a valid user in our system
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.stripeConnectAccountId) {
      return NextResponse.json({ error: 'User has no Stripe Connect account' }, { status: 400 });
    }

    if (!user.stripeIdentityVerificationId) {
      return NextResponse.json({ error: 'User has no Identity verification ID' }, { status: 400 });
    }

    logger.info('Force-verifying Connect account for user', {
      workosUserId,
      userId: user.id,
      email: user.email,
      connectAccountId: user.stripeConnectAccountId,
      identityVerificationId: user.stripeIdentityVerificationId,
    });

    const stripe = await getServerStripe();

    // Get the current account status
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    // Update the Connect account with verification status
    await stripe.accounts.update(user.stripeConnectAccountId, {
      individual: {
        first_name: 'VERIFIED_BY_PLATFORM',
        last_name: 'VERIFIED_BY_PLATFORM',
        verification: {
          document: {
            back: undefined,
            front: undefined,
          },
        },
      },
      metadata: {
        ...account.metadata,
        identity_verified: 'true',
        identity_verified_at: new Date().toISOString(),
        identity_verification_id: user.stripeIdentityVerificationId,
        force_verified: 'true',
        force_verified_at: new Date().toISOString(),
      },
    });

    // Verify the update worked by retrieving the account again
    const updatedAccount = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    // Mark the user as verified in our database
    await db
      .update(UsersTable)
      .set({
        stripeIdentityVerified: true,
        stripeIdentityVerificationStatus: 'verified',
        stripeIdentityVerificationLastChecked: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(UsersTable.id, user.id));

    return NextResponse.json({
      success: true,
      message: 'Account force-verified successfully',
      user: {
        email: user.email,
        connectAccountId: user.stripeConnectAccountId,
        identityVerificationId: user.stripeIdentityVerificationId,
        verificationStatus: updatedAccount.individual?.verification?.status,
      },
      account: {
        detailsSubmitted: updatedAccount.details_submitted,
        chargesEnabled: updatedAccount.charges_enabled,
        payoutsEnabled: updatedAccount.payouts_enabled,
      },
    });
  } catch (error) {
    logger.error('Error force-verifying Connect account', { error });
    Sentry.captureException(error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
