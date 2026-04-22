import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { getServerStripe } from '@/lib/integrations/stripe';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const { logger } = Sentry;

export const maxDuration = 60;

// Add GET handler to quickly return 405 Method Not Allowed
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// Configure the request handler
export const POST = async (request: Request) => {
  let eventType = 'unknown';
  let eventId = 'unknown';

  try {
    // Log the request info (useful for debugging)
    logger.info('Received webhook request to /api/webhooks/stripe-connect');

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!process.env.STRIPE_CONNECT_WEBHOOK_SECRET) {
      logger.error('Missing Stripe Connect webhook secret');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!signature) {
      logger.error('Missing Stripe signature header');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const stripe = await getServerStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      );

      eventType = event.type;
      eventId = event.id;
    } catch (err) {
      logger.error('Webhook signature verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    logger.info('Received Stripe Connect webhook event:', {
      type: event.type,
      id: event.id,
      timestamp: new Date().toISOString(),
    });

    // Handle the event
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await db
          .update(UsersTable)
          .set({
            stripeConnectAccountId: account.id,
            stripeConnectDetailsSubmitted: account.details_submitted,
            stripeConnectChargesEnabled: account.charges_enabled,
            stripeConnectPayoutsEnabled: account.payouts_enabled,
            stripeConnectOnboardingComplete:
              account.details_submitted && account.charges_enabled && account.payouts_enabled,
            updatedAt: new Date(),
          })
          .where(eq(UsersTable.stripeConnectAccountId, account.id));

        logger.info('Updated Connect account status:', {
          accountId: account.id,
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'account.application.deauthorized': {
        const application = event.data.object as { id: string };

        // Remove Stripe Connect account association
        await db
          .update(UsersTable)
          .set({
            stripeConnectAccountId: null,
            stripeConnectDetailsSubmitted: false,
            stripeConnectChargesEnabled: false,
            stripeConnectPayoutsEnabled: false,
            stripeConnectOnboardingComplete: false,
            updatedAt: new Date(),
          })
          .where(eq(UsersTable.stripeConnectAccountId, application.id));

        logger.info('Deauthorized Connect account:', {
          accountId: application.id,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'account.external_account.created':
      case 'account.external_account.updated':
      case 'account.external_account.deleted': {
        const externalAccount = event.data.object as Stripe.BankAccount | Stripe.Card;
        const eventType = event.type.split('.').pop(); // 'created', 'updated', or 'deleted'

        // Update user's bank account status
        if ('bank_name' in externalAccount && typeof externalAccount.account === 'string') {
          await db
            .update(UsersTable)
            .set({
              stripeBankAccountLast4: externalAccount.last4,
              stripeBankName: externalAccount.bank_name,
              updatedAt: new Date(),
            })
            .where(eq(UsersTable.stripeConnectAccountId, externalAccount.account));
        }

        logger.info(`Bank account ${eventType} for Connect account:`, {
          accountId: externalAccount.account,
          last4: externalAccount.last4,
          bankName: 'bank_name' in externalAccount ? externalAccount.bank_name : undefined,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'payout.created':
      case 'payout.paid':
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;

        // For Connect webhooks, the Connected Account ID is on event.account,
        // NOT payout.destination (which is the bank account/card ID).
        if (event.type === 'payout.failed' && event.account) {
          await db
            .update(UsersTable)
            .set({
              stripeConnectPayoutsEnabled: false,
              updatedAt: new Date(),
            })
            .where(eq(UsersTable.stripeConnectAccountId, event.account));
        }

        logger.info(`Payout ${event.type.split('.')[1]}:`, {
          payoutId: payout.id,
          connectAccountId: event.account,
          amount: payout.amount,
          currency: payout.currency,
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message,
          arrivalDate: payout.arrival_date
            ? new Date(payout.arrival_date * 1000).toISOString()
            : null,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      default:
        logger.info(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true, status: 'success' });
  } catch (error) {
    logger.error('Error in Stripe Connect webhook', {
      error: error instanceof Error ? error.message : String(error),
      eventType,
      eventId,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 },
    );
  }
};
