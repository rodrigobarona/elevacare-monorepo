import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { getIdentityVerificationStatus } from '@/lib/integrations/stripe/identity';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * GET /api/stripe/identity/verification/status
 *
 * Gets the current user's verification status by checking both database and Stripe API
 * This is the single source of truth for verification status across the application
 *
 * @returns 200 - Verification status information with consistent response shape
 * @returns 401 - Unauthorized if no user is authenticated
 * @returns 404 - User not found in database
 * @returns 500 - Server error during verification status check
 */
export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          actionRequired: 'login',
          nextSteps: 'Please sign in to access verification status.',
        },
        { status: 401 },
      );
    }

    // Get user record from database
    const dbUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          actionRequired: 'registration',
          nextSteps: 'Complete your profile setup before verification.',
        },
        { status: 404 },
      );
    }

    // Build a standardized response with information about next steps for each status
    const buildResponse = (
      verified: boolean,
      status: string,
      lastUpdated: Date | string | null,
      source: string,
      additionalInfo: Record<string, unknown> = {},
    ) => {
      const statusInfo: Record<
        string,
        {
          description: string;
          nextSteps: string;
          actionRequired: string;
        }
      > = {
        verified: {
          description: 'Your identity has been successfully verified.',
          nextSteps: 'You can now proceed to payment setup.',
          actionRequired: 'none',
        },
        processing: {
          description: 'Your verification is currently being processed.',
          nextSteps: 'Please check back in a few minutes.',
          actionRequired: 'wait',
        },
        requires_input: {
          description: 'Additional information is required to complete verification.',
          nextSteps:
            'Please resume the verification process and provide the requested information.',
          actionRequired: 'resume',
        },
        canceled: {
          description: 'The verification process was canceled.',
          nextSteps: 'Start a new verification process when you are ready.',
          actionRequired: 'restart',
        },
        failed: {
          description: 'The verification process failed.',
          nextSteps: 'Review the failure reason and try again with valid documents.',
          actionRequired: 'restart',
        },
        not_started: {
          description: 'You have not started the identity verification process.',
          nextSteps: 'Start the verification process to continue.',
          actionRequired: 'start',
        },
        unknown: {
          description: 'Your verification status could not be determined.',
          nextSteps: 'Please try again or contact support if the issue persists.',
          actionRequired: 'retry',
        },
      };

      // Get status info or default to unknown
      const info = status in statusInfo ? statusInfo[status] : statusInfo.unknown;

      // Build and return the standardized response
      return {
        success: true,
        verified,
        status,
        statusDescription: info.description,
        actionRequired: info.actionRequired,
        nextSteps: info.nextSteps,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
        source,
        ...additionalInfo,
      };
    };

    // If already verified in database, return that status
    if (dbUser.stripeIdentityVerified) {
      return NextResponse.json(
        buildResponse(true, 'verified', dbUser.stripeIdentityVerificationLastChecked, 'database'),
      );
    }

    // If user has a verification ID, check status with Stripe
    if (dbUser.stripeIdentityVerificationId) {
      try {
        // Get verification status from Stripe API
        const verificationStatus = await getIdentityVerificationStatus(
          dbUser.stripeIdentityVerificationId,
        );

        // If status has changed or verification is now complete, update database
        if (
          verificationStatus.status !== dbUser.stripeIdentityVerificationStatus ||
          (verificationStatus.status === 'verified' && !dbUser.stripeIdentityVerified)
        ) {
          await db
            .update(UsersTable)
            .set({
              stripeIdentityVerified: verificationStatus.status === 'verified',
              stripeIdentityVerificationStatus: verificationStatus.status,
              stripeIdentityVerificationLastChecked: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(UsersTable.id, dbUser.id));
        }

        return NextResponse.json(
          buildResponse(
            verificationStatus.status === 'verified',
            verificationStatus.status,
            verificationStatus.lastUpdated || new Date(),
            'stripe_api',
            // Include any additional information that might be helpful
            verificationStatus.details ? { verificationDetails: verificationStatus.details } : {},
          ),
        );
      } catch (error) {
        Sentry.captureException(error);
        logger.error('Error checking verification with Stripe API', { error });
        // Fall back to database status if API call fails
        return NextResponse.json(
          buildResponse(
            dbUser.stripeIdentityVerified || false,
            dbUser.stripeIdentityVerificationStatus || 'unknown',
            dbUser.stripeIdentityVerificationLastChecked,
            'database_fallback',
            { error: 'Failed to retrieve latest status from Stripe' },
          ),
        );
      }
    }

    // No verification has been started
    return NextResponse.json(buildResponse(false, 'not_started', null, 'initial_state'));
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error getting identity verification status', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get identity verification status',
        status: 'error',
        statusDescription: 'An unexpected error occurred while checking verification status.',
        actionRequired: 'retry',
        nextSteps: 'Please try again or contact support if the issue persists.',
      },
      { status: 500 },
    );
  }
}
