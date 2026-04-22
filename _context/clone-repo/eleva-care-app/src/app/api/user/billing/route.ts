import { getServerStripe, getStripeConnectAccountStatus } from '@/lib/integrations/stripe';
import { ensureFullUserSynchronization } from '@/server/actions/user-sync';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const { logger } = Sentry;

// Mark route as dynamic

export async function GET() {
  let workosUserId: string | null = null;
  const stripe = await getServerStripe();

  try {
    // Get the authenticated user ID
    const { user } = await withAuth();
    const userId = user?.id;
    workosUserId = userId ?? null;
    logger.info('Auth check result', { userId, hasId: !!userId });

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use our synchronization service to ensure all systems are in sync
    const dbUser = await ensureFullUserSynchronization(userId);

    if (!dbUser) {
      logger.error('Failed to synchronize user', { workosUserId: userId });
      return NextResponse.json({ error: 'User synchronization failed' }, { status: 500 });
    }

    // Fetch customer data from Stripe directly
    let customerData: Stripe.Customer | null = null;
    try {
      if (dbUser.stripeCustomerId) {
        const customerResponse = await stripe.customers.retrieve(dbUser.stripeCustomerId);
        if (!('deleted' in customerResponse)) {
          customerData = customerResponse;
          logger.info('Retrieved customer data', {
            customerId: customerData.id,
            hasDefaultPaymentMethod: !!customerData.invoice_settings?.default_payment_method,
          });
        }
      }
    } catch (stripeError) {
      logger.error('Error retrieving Stripe customer', { error: stripeError });
    }

    // Get Stripe account status if connected
    let accountStatus = null;
    if (dbUser.stripeConnectAccountId) {
      try {
        accountStatus = await getStripeConnectAccountStatus(dbUser.stripeConnectAccountId);
      } catch (stripeError) {
        logger.error('Error retrieving Stripe Connect account status', { error: stripeError });
      }
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        stripeConnectAccountId: dbUser.stripeConnectAccountId,
        stripeIdentityVerified: dbUser.stripeIdentityVerified ?? false,
      },
      customer: customerData
        ? {
            id: customerData.id,
            defaultPaymentMethod: customerData.invoice_settings?.default_payment_method || null,
            email: customerData.email,
          }
        : null,
      accountStatus,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error in user billing API', {
      error,
      workosUserId,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
