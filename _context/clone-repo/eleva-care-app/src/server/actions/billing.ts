import { STRIPE_CONNECT_SUPPORTED_COUNTRIES } from '@/config/stripe';
import { db, invalidateCache } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import {
  createStripeConnectAccount,
  getServerStripe,
  getStripeConnectSetupOrLoginLink,
} from '@/lib/integrations/stripe';
import { withAuth } from '@workos-inc/authkit-nextjs';
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const { logger } = Sentry;

/**
 * @fileoverview Server actions for managing Stripe Connect integration in the Eleva Care application.
 * This file handles the creation and management of Stripe Connect accounts for experts,
 * enabling them to receive payments through the platform. It provides functionality for
 * account creation, login link generation, and account management.

 * Initiates the Stripe Connect account creation process for an expert.
 *
 * This function:
 * 1. Validates the user exists in our database
 * 2. Gets or sets the user's country from user metadata
 * 3. Creates a Stripe Connect account for the expert
 * 4. Updates the user's record with the new Stripe Connect account ID
 * 5. Returns the onboarding URL for the expert to complete their setup
 *
 * @param workosUserId - The WorkOS user ID of the expert
 * @returns Promise that resolves to either:
 *   - The Stripe Connect onboarding URL (string)
 *   - null if the process fails or user is not found
 *
 * @example
 * const onboardingUrl = await handleConnectStripe("user_123");
 * if (onboardingUrl) {
 *   // Redirect user to onboardingUrl to complete Stripe Connect setup
 * } else {
 *   console.error("Failed to create Stripe Connect account");
 * }
 */
export async function handleConnectStripe(workosUserId: string): Promise<string | null> {
  return Sentry.withServerActionInstrumentation('handleConnectStripe', { recordResponse: true }, async () => {
  if (!workosUserId) return null;

  try {
    // Get user data from our database
    const dbUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    if (!dbUser) {
      logger.error('User not found in database');
      return null;
    }

    if (!dbUser.email) {
      logger.error('User email not found');
      return null;
    }

    // Get country from database or default to US
    let country = dbUser.country || 'US';

    // Ensure country code is uppercase
    country = country.toUpperCase();

    // Validate country is supported by Stripe Connect
    // See: https://stripe.com/global
    if (!(STRIPE_CONNECT_SUPPORTED_COUNTRIES as readonly string[]).includes(country)) {
      logger.error('Country not supported by Stripe Connect', { country });
      return null;
    }

    // Create Stripe Connect account
    const { accountId } = await createStripeConnectAccount(dbUser.email, country);

    // Update our database
    await db
      .update(UsersTable)
      .set({
        stripeConnectAccountId: accountId,
        country: country, // Store the country in our database
        updatedAt: new Date(),
      })
      .where(eq(UsersTable.workosUserId, workosUserId));

    await invalidateCache([`user-${workosUserId}`, `user-full-${workosUserId}`]);

    const url = await getStripeConnectSetupOrLoginLink(accountId);
    return url;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'handleConnectStripe' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Failed to create Stripe Connect account', { error });
    return null;
  }
  });
}

/**
 * Generates a login link for an existing Stripe Connect account.
 *
 * This function creates a unique URL that allows experts to access their
 * Stripe Connect dashboard or complete their account setup if not finished.
 *
 * @param stripeConnectAccountId - The ID of the expert's Stripe Connect account
 * @returns Promise that resolves to the Stripe Connect dashboard URL
 * @throws Error if the account ID is missing or invalid
 *
 * @example
 * try {
 *   const dashboardUrl = await getConnectLoginLink("acct_123");
 *   // Redirect user to dashboardUrl to access their Stripe dashboard
 * } catch (error) {
 *   console.error("Failed to generate login link:", error);
 * }
 */
export async function getConnectLoginLink(stripeConnectAccountId: string) {
  return Sentry.withServerActionInstrumentation('getConnectLoginLink', { recordResponse: true }, async () => {
  if (!stripeConnectAccountId) {
    throw new Error('Stripe Connect Account ID is required');
  }

  try {
    return await getStripeConnectSetupOrLoginLink(stripeConnectAccountId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'getConnectLoginLink' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Failed to create Stripe Connect link', { error });
    throw error;
  }
  });
}

/**
 * Creates a refund for a connected account charge with proper application fee handling.
 *
 * @param chargeId - The ID of the charge to refund
 * @param amount - Optional partial refund amount in cents (full refund if not provided)
 * @param reason - Optional refund reason
 * @returns Promise with refund result
 */
export async function createConnectRefund(
  chargeId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
) {
  return Sentry.withServerActionInstrumentation('createConnectRefund', { recordResponse: true }, async () => {
  try {
    const stripe = await getServerStripe();
    const { user } = await withAuth();
    if (!user) {
      return { success: false, message: 'Not authenticated' };
    }
    const userId = user.id;

    // Get user's connected account ID
    const dbUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, userId),
    });

    if (!dbUser?.stripeConnectAccountId) {
      return { success: false, message: 'No connected Stripe account found' };
    }

    // Create refund with application fee refund enabled
    const refund = await stripe.refunds.create(
      {
        charge: chargeId,
        refund_application_fee: true, // Refunds the platform fee
        ...(amount && { amount }), // Partial refund if amount specified
        ...(reason && { reason }),
      },
      {
        stripeAccount: dbUser.stripeConnectAccountId,
      },
    );

    logger.info('Refund created successfully', {
      refundId: refund.id,
      chargeId,
      amount: refund.amount,
      status: refund.status,
      userId,
    });

    return {
      success: true,
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
      },
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'createConnectRefund' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Failed to create refund', { error });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process refund',
    };
  }
  });
}
