import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { getServerStripe } from '@/lib/integrations/stripe';
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';

const { logger } = Sentry;
import Stripe from 'stripe';

/**
 * @fileoverview Server actions for managing expert accounts in the Eleva Care application.
 * This file handles expert-related operations including Stripe Connect account verification,
 * payout schedule management, and account status updates. It provides functionality for both
 * individual expert verification and admin-level expert management.
 */

/**
 * Verifies an expert's Stripe Connect account status and updates their onboarding status if necessary.
 *
 * This function performs several checks:
 * 1. Retrieves the user's Stripe Connect account ID from the database
 * 2. Verifies the existence of the Stripe Connect account
 * 3. Checks if the account is fully set up (details submitted, payouts enabled, transfers active)
 * 4. Updates the user's onboarding status in the database if needed
 *
 * @param workosUserId - The WorkOS user ID of the expert to verify
 * @returns An object containing:
 *   - error: boolean indicating if an error occurred
 *   - code?: error code if applicable
 *   - message?: error message if applicable
 *   - accountStatus?: object containing account verification details
 *     - detailsSubmitted: whether account details are complete
 *     - payoutsEnabled: whether payouts are enabled
 *     - transfersEnabled: whether transfers are active
 *     - requiresRefresh: whether the account needs updating
 *     - accountId: the Stripe Connect account ID
 */
export async function verifyExpertConnectAccount(workosUserId: string) {
  return Sentry.withServerActionInstrumentation('verifyExpertConnectAccount', { recordResponse: true }, async () => {
  try {
    const stripe = await getServerStripe();
    // Get the user's Stripe Connect account ID
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });
    // Log the user's Stripe Connect account ID
    if (!user?.stripeConnectAccountId) {
      logger.error('No Stripe Connect account found for user', {
        workosUserId,
        email: user?.email,
      });
      return {
        error: true,
        code: 'NO_CONNECT_ACCOUNT',
        message: 'No Stripe Connect account found for this user',
      };
    }

    // Retrieve the Connect account from Stripe
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    // Check if the account is fully set up
    const isFullySetup =
      account.details_submitted &&
      account.payouts_enabled &&
      account.capabilities?.transfers === 'active';

    if (isFullySetup && !user.stripeConnectOnboardingComplete) {
      // Update the user record to mark onboarding as complete
      await db
        .update(UsersTable)
        .set({
          stripeConnectOnboardingComplete: true,
        })
        .where(eq(UsersTable.workosUserId, workosUserId));

      logger.info('Updated Connect account status to complete', {
        workosUserId,
        email: user.email,
        accountId: user.stripeConnectAccountId,
      });
    }

    return {
      error: false,
      accountStatus: {
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        transfersEnabled: account.capabilities?.transfers === 'active',
        requiresRefresh: !isFullySetup,
        accountId: user.stripeConnectAccountId,
      },
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'verifyExpertConnectAccount' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Error verifying Connect account', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workosUserId,
    });
    return {
      error: true,
      code: 'VERIFICATION_ERROR',
      message: 'Failed to verify Connect account status',
    };
  }
  });
}

/**
 * Retrieves the payout schedule for an expert's Stripe Connect account.
 *
 * This function:
 * 1. Verifies the expert has a Stripe Connect account
 * 2. Retrieves the account's payout schedule settings
 * 3. Returns the schedule details including interval, anchors, and delay days
 *
 * @param workosUserId - The WorkOS user ID of the expert
 * @returns An object containing:
 *   - error: boolean indicating if an error occurred
 *   - code?: error code if applicable
 *   - message?: error message if applicable
 *   - schedule?: object containing payout schedule details
 *     - interval: payout frequency (daily, weekly, monthly)
 *     - monthlyAnchor: day of month for monthly payouts
 *     - weeklyAnchor: day of week for weekly payouts
 *     - delay_days: days to delay payouts
 */
export async function getExpertPayoutSchedule(workosUserId: string) {
  return Sentry.withServerActionInstrumentation('getExpertPayoutSchedule', { recordResponse: true }, async () => {
  try {
    const stripe = await getServerStripe();
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    if (!user?.stripeConnectAccountId) {
      return {
        error: true,
        code: 'NO_CONNECT_ACCOUNT',
        message: 'No Stripe Connect account found for this user',
      };
    }

    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    // Log the account details
    return {
      error: false,
      schedule: {
        interval: account.settings?.payouts?.schedule?.interval,
        monthlyAnchor: account.settings?.payouts?.schedule?.monthly_anchor,
        weeklyAnchor: account.settings?.payouts?.schedule?.weekly_anchor,
        delay_days: account.settings?.payouts?.schedule?.delay_days,
      },
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'getExpertPayoutSchedule' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Error getting payout schedule', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workosUserId,
    });
    return {
      error: true,
      code: 'SCHEDULE_ERROR',
      message: 'Failed to retrieve payout schedule',
    };
  }
  });
}

/**
 * Verifies a specific expert's account by their email address.
 * This is typically used by administrators to verify individual expert accounts.
 *
 * The function:
 * 1. Looks up the expert by email in the database
 * 2. If found, calls verifyExpertConnectAccount with their WorkOS user ID
 *
 * @param email - The email address of the expert to verify
 * @returns The same return type as verifyExpertConnectAccount
 */
export async function verifySpecificExpertAccount(email: string) {
  return Sentry.withServerActionInstrumentation('verifySpecificExpertAccount', { recordResponse: true }, async () => {
  try {
    // Get the user by email
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.email, email),
    });

    if (!user) {
      logger.error('User not found', { email });
      return {
        error: true,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      };
    }

    return verifyExpertConnectAccount(user.workosUserId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'verifySpecificExpertAccount' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Error verifying specific expert account', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email,
    });
    return {
      error: true,
      code: 'VERIFICATION_ERROR',
      message: 'Failed to verify expert account',
    };
  }
  });
}

/**
 * Performs a comprehensive verification and update of a specific expert's account.
 * This function combines account verification and payout schedule retrieval.
 *
 * The function:
 * 1. Verifies the expert's account status
 * 2. If successful, retrieves their payout schedule
 * 3. Combines both results into a single response
 *
 * @param email - The email address of the expert to verify and update
 * @returns An object containing:
 *   - All fields from verifySpecificExpertAccount
 *   - payoutSchedule: The expert's payout schedule if available
 */
export async function verifyAndUpdateSpecificExpert(email: string) {
  return Sentry.withServerActionInstrumentation('verifyAndUpdateSpecificExpert', { recordResponse: true }, async () => {
  try {
    const result = await verifySpecificExpertAccount(email);

    if (result.error || !result.accountStatus?.accountId) {
      return result;
    }

    // Look up workosUserId for payout schedule (getExpertPayoutSchedule expects
    // a WorkOS user ID, not a Stripe account ID)
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.email, email),
      columns: { workosUserId: true },
    });

    if (!user) {
      return result;
    }

    const scheduleResult = await getExpertPayoutSchedule(user.workosUserId);

    return {
      ...result,
      payoutSchedule: scheduleResult.error ? null : scheduleResult.schedule,
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      Sentry.captureException(error, {
        tags: { stripeErrorType: error.type, operation: 'verifyAndUpdateSpecificExpert' },
        extra: { code: error.code, param: error.param },
      });
    }
    logger.error('Error in verifyAndUpdateSpecificExpert', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email,
    });
    return {
      error: true,
      code: 'UPDATE_ERROR',
      message: 'Failed to verify and update expert account',
    };
  }
  });
}
