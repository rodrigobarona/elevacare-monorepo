import * as Sentry from '@sentry/nextjs';
import { triggerWorkflow } from '@/lib/integrations/novu/client';

const { logger } = Sentry;
import { db } from '@/drizzle/db';
import { ProfilesTable, UsersTable } from '@/drizzle/schema';
import { NOTIFICATION_TYPE_ACCOUNT_UPDATE } from '@/lib/constants/notifications';
import { withRetry } from '@/lib/integrations/stripe';
import { createUserNotification } from '@/lib/notifications/core';
// markStepComplete is available for future use when expert setup steps need to be tracked
// import { markStepComplete } from '@/server/actions/expert-setup';
import { eq } from 'drizzle-orm';
import type { Stripe } from 'stripe';

// Helper function to generate account update message
export function getAccountUpdateMessage(account: Stripe.Account): string {
  if (account.charges_enabled && account.payouts_enabled) {
    return 'Your Stripe Connect account has been fully activated. You can now receive payments for your services.';
  }
  if (account.details_submitted) {
    return "Your account details are being reviewed by Stripe. This usually takes 24-48 hours. We'll notify you once your account is fully activated.";
  }
  return 'Your account status has been updated. Please complete the required information to activate your payment account.';
}

/**
 * Handles updates to a user's Stripe Connect account status
 * Implements retry logic for critical operations to ensure robustness
 */
export async function handleAccountUpdated(account: Stripe.Account) {
  logger.info('Connect account updated', { accountId: account.id });

  // Find the user associated with this account
  let user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.stripeConnectAccountId, account.id),
  });

  if (!user) {
    // Try metadata lookup: Connect account creation sets workosUserId (camelCase)
    if (account.metadata?.workosUserId) {
      user = await db.query.UsersTable.findFirst({
        where: eq(UsersTable.workosUserId, account.metadata.workosUserId),
      });
    }

    // Try looking up by email if available
    if (!user && account.email) {
      user = await db.query.UsersTable.findFirst({
        where: eq(UsersTable.email, account.email),
      });
    }

    if (!user) {
      logger.error('User not found for Connect account:', {
        accountId: account.id,
        metadata: account.metadata,
        email: account.email,
      });
      return;
    }
  }

  const previousPayoutsEnabled = user.stripeConnectPayoutsEnabled;
  const previousChargesEnabled = user.stripeConnectChargesEnabled;

  // Fetch user profile for name (firstName/lastName are in ProfilesTable, not UsersTable)
  const profile = await db.query.ProfilesTable.findFirst({
    where: eq(ProfilesTable.workosUserId, user.workosUserId),
  });

  try {
    // Use withRetry for the critical database operations to handle transient errors
    await withRetry(
      async () => {
        // Use a transaction to ensure all operations succeed or fail together
        await db.transaction(async (tx) => {
          // Update user record
          await tx
            .update(UsersTable)
            .set({
              stripeConnectDetailsSubmitted: account.details_submitted,
              stripeConnectPayoutsEnabled: account.payouts_enabled,
              stripeConnectChargesEnabled: account.charges_enabled,
              stripeConnectOnboardingComplete: account.charges_enabled && account.payouts_enabled,
              updatedAt: new Date(),
            })
            .where(eq(UsersTable.id, user.id));

          // If account is fully enabled, mark payment step as complete
          if (account.charges_enabled && account.payouts_enabled) {
            // Note: markStepComplete now gets user from auth context
            // For webhooks, we need to ensure we're in the right context
            logger.info('Payment setup completed for user', { workosUserId: user.workosUserId });
            // TODO: Implement webhook-specific step completion that doesn't require auth context
          }

          // Create notification if payout or charges status has changed
          if (
            previousPayoutsEnabled !== account.payouts_enabled ||
            previousChargesEnabled !== account.charges_enabled
          ) {
            // Use existing notification system
            await createUserNotification({
              userId: user.id,
              type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
              data: {
                userName: profile?.firstName || user.username || 'User',
                message: getAccountUpdateMessage(account),
                actionUrl: '/account/connect',
                accountId: account.id,
                statusType: 'payout_charges_status_change',
              },
            });

            // Also trigger Novu workflow for enhanced platform payment notifications
            try {
              await triggerWorkflow({
                workflowId: 'platform-payments-universal',
                to: {
                  subscriberId: user.workosUserId,
                  email: user.email || 'no-email@eleva.care',
                  firstName: profile?.firstName || '',
                  lastName: profile?.lastName || '',
                  data: {
                    stripeAccountId: account.id,
                    role: 'expert',
                  },
                },
                payload: {
                  title: getConnectAccountStatusTitle(account),
                  message: getAccountUpdateMessage(account),
                  requiresAction: !account.charges_enabled || !account.payouts_enabled ? 1 : 0,
                  actionRequired: getActionRequired(account) || '',
                  actionUrl: '/account/connect',
                  accountId: account.id,
                  chargesEnabled: account.charges_enabled ? 1 : 0,
                  payoutsEnabled: account.payouts_enabled ? 1 : 0,
                  detailsSubmitted: account.details_submitted ? 1 : 0,
                },
                actor: {
                  subscriberId: 'system',
                  data: {
                    source: 'stripe-webhook',
                    accountId: account.id,
                    timestamp: new Date().toISOString(),
                  },
                },
              });
              logger.info('Novu workflow triggered for Connect account update');
            } catch (novuError) {
              logger.error('Failed to trigger Novu workflow', {
                error: novuError instanceof Error ? novuError.message : String(novuError),
              });
              // Don't fail the entire webhook for Novu errors
            }
          }
        });
      },
      3,
      1000,
    ); // Retry up to 3 times with 1s initial delay (doubles each retry)
  } catch (error) {
    logger.error('Error updating Connect account status after retries', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Store the failed operation for manual recovery
    // This could be logged to a database table or monitoring system
    const operationDetails = {
      operation: 'connect-account-update',
      accountId: account.id,
      userId: user.id,
      status: {
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      },
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

function getConnectAccountStatusTitle(account: Stripe.Account): string {
  if (account.charges_enabled && account.payouts_enabled) {
    return 'Payment Account Activated! 🎉';
  }
  if (account.details_submitted) {
    return 'Account Under Review';
  }
  return 'Payment Account Setup Required';
}

function getActionRequired(account: Stripe.Account): string | undefined {
  if (!account.details_submitted) {
    return 'Complete your payment account setup to start receiving payments';
  }
  if (!account.charges_enabled || !account.payouts_enabled) {
    return 'Please wait for Stripe to review your account details';
  }
  return undefined;
}
