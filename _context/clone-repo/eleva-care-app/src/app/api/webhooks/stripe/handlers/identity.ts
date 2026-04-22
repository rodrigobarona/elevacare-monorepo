import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { ProfilesTable, UsersTable } from '@/drizzle/schema';
import {
  NOTIFICATION_TYPE_ACCOUNT_UPDATE,
  NOTIFICATION_TYPE_SECURITY_ALERT,
} from '@/lib/constants/notifications';
import { withRetry } from '@/lib/integrations/stripe';
import { createUserNotification } from '@/lib/notifications/core';
// markStepComplete is available for future use when expert setup steps need to be tracked
// import { markStepComplete } from '@/server/actions/expert-setup';
import { eq } from 'drizzle-orm';
import type { Stripe } from 'stripe';

const { logger } = Sentry;

/**
 * Handles updates to a user's identity verification status
 * Implements retry logic for critical operations to ensure robustness
 */
export async function handleIdentityVerificationUpdated(
  verificationSession: Stripe.Identity.VerificationSession,
) {
  logger.info('Identity verification updated:', { verificationSessionId: verificationSession.id });

  // Find the user associated with this verification - in Stripe Identity API
  // the verification session contains a 'client_reference_id' which could be
  // the Connect account ID, user ID, or another reference
  let user = null;

  // First try to find by client_reference_id if available
  if (verificationSession.client_reference_id) {
    user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.stripeConnectAccountId, verificationSession.client_reference_id),
    });

    if (!user) {
      // Maybe the reference is actually a user ID?
      user = await db.query.UsersTable.findFirst({
        where: eq(UsersTable.id, verificationSession.client_reference_id),
      });
    }
  }

  // Try metadata lookup: createIdentityVerification sets userId (camelCase) and workosUserId
  if (!user && verificationSession.metadata?.workosUserId) {
    user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, verificationSession.metadata.workosUserId),
    });
  }

  if (!user && verificationSession.metadata?.userId) {
    user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.id, verificationSession.metadata.userId),
    });
  }

  if (!user) {
    logger.error('User not found for verification session:', {
      sessionId: verificationSession.id,
      clientReference: verificationSession.client_reference_id,
      metadata: verificationSession.metadata,
    });
    return;
  }

  // Fetch user profile for name (firstName/lastName are in ProfilesTable, not UsersTable)
  const profile = await db.query.ProfilesTable.findFirst({
    where: eq(ProfilesTable.workosUserId, user.workosUserId),
  });

  try {
    // Use withRetry for the critical database operations to handle transient errors
    await withRetry(
      async () => {
        await db.transaction(async (tx) => {
          // Update user record
          await tx
            .update(UsersTable)
            .set({
              stripeIdentityVerificationStatus: verificationSession.status,
              stripeIdentityVerified: verificationSession.status === 'verified',
              updatedAt: new Date(),
            })
            .where(eq(UsersTable.id, user.id));

          // Handle verification completion
          if (verificationSession.status === 'verified') {
            // Note: markStepComplete now gets user from auth context
            // For webhooks, we need to ensure we're in the right context
            logger.info('Identity verification completed for user:', { workosUserId: user.workosUserId });
            // TODO: Implement webhook-specific step completion that doesn't require auth context
            await createUserNotification({
              userId: user.id,
              type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
              data: {
                userName: profile?.firstName || user.username || 'User',
                title: 'Identity Verification Complete',
                message: 'Your identity verification has been completed successfully.',
                actionUrl: '/account/verification',
              },
            });
          } else if (verificationSession.status === 'requires_input') {
            await createUserNotification({
              userId: user.id,
              type: NOTIFICATION_TYPE_SECURITY_ALERT,
              data: {
                userName: profile?.firstName || user.username || 'User',
                title: 'Identity Verification Needs Attention',
                message:
                  'Your identity verification requires additional information. Please review and resubmit.',
                actionUrl: '/account/verification',
              },
            });
          }
        });
      },
      3,
      1000,
    ); // Retry up to 3 times with 1s initial delay (doubles each retry)
  } catch (error) {
    logger.error('Error handling identity verification update after retries', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Store the failed operation for manual recovery
    // This could be logged to a database table or monitoring system
    const operationDetails = {
      operation: 'identity-verification-update',
      verificationSessionId: verificationSession.id,
      verificationStatus: verificationSession.status,
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };

    // Log to a persistent store for administrative review
    logger.error('Critical operation failed, needs manual intervention', operationDetails as Record<string, unknown>);

    // In a production environment, you might want to:
    // 1. Log to error tracking system (Sentry, Datadog, etc.)
    // 2. Add to a dead letter queue for later processing
    // 3. Send alerts to administrators
    // 4. Record in a dedicated "failed_operations" table
  }
}
