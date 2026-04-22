import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { getIdentityVerificationStatus } from '@/lib/integrations/stripe/identity';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * GET /api/stripe/identity/status
 *
 * Gets the status of the current user's Stripe Identity verification
 *
 * @returns 200 - Verification status information
 * @returns 401 - Unauthorized if no user is authenticated
 * @returns 404 - User not found in database
 * @returns 500 - Server error during verification status check
 */
export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record from database
    const dbUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!dbUser.stripeIdentityVerificationId) {
      return NextResponse.json({
        verified: false,
        status: 'not_started',
        message: 'Identity verification not started',
      });
    }

    // Get verification status
    const verificationStatus = await getIdentityVerificationStatus(
      dbUser.stripeIdentityVerificationId,
    );

    // Update the database with the latest status
    await db
      .update(UsersTable)
      .set({
        stripeIdentityVerified: verificationStatus.status === 'verified',
        stripeIdentityVerificationStatus: verificationStatus.status,
        stripeIdentityVerificationLastChecked: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(UsersTable.id, dbUser.id));

    return NextResponse.json({
      verified: verificationStatus.status === 'verified',
      status: verificationStatus.status,
      lastUpdated: verificationStatus.lastUpdated,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error getting identity verification status', { error });
    return NextResponse.json(
      { error: 'Failed to get identity verification status' },
      { status: 500 },
    );
  }
}
