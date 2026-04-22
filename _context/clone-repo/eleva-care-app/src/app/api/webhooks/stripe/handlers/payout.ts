import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { ProfilesTable, UsersTable } from '@/drizzle/schema';
import { triggerWorkflow } from '@/lib/integrations/novu/client';
import { addDays, format } from 'date-fns';
import { eq } from 'drizzle-orm';
import type { Stripe } from 'stripe';

/**
 * Handles Stripe Connect payout events for platform payments
 */
export async function handlePayoutPaid(payout: Stripe.Payout) {
  return Sentry.startSpan(
    {
      name: 'stripe.payout.paid',
      op: 'webhook.handler',
      attributes: {
        'stripe.payout_id': payout.id,
        'stripe.payout_amount': payout.amount,
        'stripe.payout_currency': payout.currency,
        'stripe.payout_status': payout.status,
      },
    },
    async (span) => {
      Sentry.logger.info('Payout processed', {
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
      });

      try {
        // Extract the destination account ID - it should be a string for Connect accounts
        const destinationAccountId =
          typeof payout.destination === 'string' ? payout.destination : null;

        if (!destinationAccountId) {
          Sentry.logger.error('Invalid payout destination type', {
            payoutId: payout.id,
            destinationType: typeof payout.destination,
          });
          return;
        }

        span.setAttribute('stripe.destination_account_id', destinationAccountId);

        // Find the user associated with this Connect account
        const user = await db.query.UsersTable.findFirst({
          where: eq(UsersTable.stripeConnectAccountId, destinationAccountId),
        });

        if (!user) {
          Sentry.logger.error('User not found for Connect account', {
            payoutId: payout.id,
            destinationAccountId,
          });
          return;
        }

        span.setAttribute('stripe.workos_user_id', user.workosUserId);

        // Fetch expert's profile for professional name
        const profile = await db.query.ProfilesTable.findFirst({
          where: eq(ProfilesTable.workosUserId, user.workosUserId),
        });

        // Use professional name from profile, fallback to username
        const expertName = profile
          ? `${profile.firstName} ${profile.lastName}`.trim()
          : user.username || 'Expert';

        // Calculate expected arrival date based on payout arrival_date or estimate
        const arrivalDate = payout.arrival_date
          ? new Date(payout.arrival_date * 1000)
          : addDays(new Date(), 2); // Default 2 business days

        const expectedArrival = format(arrivalDate, 'EEEE, MMMM d, yyyy');
        const amount = (payout.amount / 100).toFixed(2); // Convert cents to euros

        // Trigger Novu workflow for payout notification
        try {
          await triggerWorkflow({
            workflowId: 'expert-payout-notification',
            to: {
              subscriberId: user.workosUserId,
              email: user.email || 'no-email@eleva.care',
              firstName: profile?.firstName || '',
              lastName: profile?.lastName || '',
            },
            payload: {
              // Use professional name from profile
              expertName,
              payoutAmount: amount,
              currency: 'EUR',
              appointmentDate: format(new Date(), 'EEEE, MMMM d, yyyy'),
              appointmentTime: format(new Date(), 'h:mm a'),
              clientName: 'Client', // Could be enhanced to get actual client data
              serviceName: 'Professional consultation',
              payoutId: payout.id,
              expectedArrivalDate: expectedArrival,
              bankLastFour: destinationAccountId.slice(-4),
              dashboardUrl: '/account/billing',
              supportUrl: '/support',
              locale: 'en',
            },
          });
          Sentry.logger.info('Platform payout notification sent via Novu', {
            payoutId: payout.id,
            workosUserId: user.workosUserId,
          });
        } catch (novuError) {
          Sentry.logger.error('Failed to trigger platform payout notification', {
            payoutId: payout.id,
            error: novuError instanceof Error ? novuError.message : 'Unknown error',
          });
        }

        span.setAttribute('stripe.payout.handled', true);
      } catch (error) {
        Sentry.logger.error('Error in handlePayoutPaid', {
          payoutId: payout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}

export async function handlePayoutFailed(payout: Stripe.Payout) {
  return Sentry.startSpan(
    {
      name: 'stripe.payout.failed',
      op: 'webhook.handler',
      attributes: {
        'stripe.payout_id': payout.id,
        'stripe.payout_amount': payout.amount,
        'stripe.payout_currency': payout.currency,
        'stripe.payout_status': payout.status,
        'stripe.payout_failure_code': payout.failure_code || 'unknown',
      },
    },
    async (span) => {
      Sentry.logger.warn('Payout failed', {
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message,
      });

      try {
        // Extract the destination account ID - it should be a string for Connect accounts
        const destinationAccountId =
          typeof payout.destination === 'string' ? payout.destination : null;

        if (!destinationAccountId) {
          Sentry.logger.error('Invalid payout destination type', {
            payoutId: payout.id,
            destinationType: typeof payout.destination,
          });
          return;
        }

        span.setAttribute('stripe.destination_account_id', destinationAccountId);

        // Find the user associated with this Connect account
        const user = await db.query.UsersTable.findFirst({
          where: eq(UsersTable.stripeConnectAccountId, destinationAccountId),
        });

        if (!user) {
          Sentry.logger.error('User not found for Connect account', {
            payoutId: payout.id,
            destinationAccountId,
          });
          return;
        }

        span.setAttribute('stripe.workos_user_id', user.workosUserId);

        // Fetch expert's profile for professional name
        const profile = await db.query.ProfilesTable.findFirst({
          where: eq(ProfilesTable.workosUserId, user.workosUserId),
        });

        // Use professional name from profile, fallback to username
        const expertName = profile
          ? `${profile.firstName} ${profile.lastName}`.trim()
          : user.username || 'Expert';

        const amount = (payout.amount / 100).toFixed(2);
        const failureReason = payout.failure_message || 'Unknown reason';

        // Trigger Novu workflow for payout failure notification
        try {
          await triggerWorkflow({
            workflowId: 'platform-payments-universal',
            to: {
              subscriberId: user.workosUserId,
              email: user.email || 'no-email@eleva.care',
              firstName: profile?.firstName || '',
              lastName: profile?.lastName || '',
            },
            payload: {
              eventType: 'payout-failed',
              amount: `€${amount}`,
              // Use professional name from profile
              expertName,
              accountStatus: 'action_required',
              message: `Your payout of €${amount} has failed. Reason: ${failureReason}. Please check your bank account details and contact support if needed.`,
            },
          });
          Sentry.logger.info('Platform payout failure notification sent via Novu', {
            payoutId: payout.id,
            workosUserId: user.workosUserId,
          });
        } catch (novuError) {
          Sentry.logger.error('Failed to trigger platform payout failure notification', {
            payoutId: payout.id,
            error: novuError instanceof Error ? novuError.message : 'Unknown error',
          });
        }

        span.setAttribute('stripe.payout_failed.handled', true);
      } catch (error) {
        Sentry.logger.error('Error in handlePayoutFailed', {
          payoutId: payout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
