import { getMinimumPayoutDelay, STRIPE_CONNECT_SUPPORTED_COUNTRIES } from '@/config/stripe';
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';

import { getBaseUrl, getServerStripe } from './client';

const { logger } = Sentry;

export type CreateIdentityVerificationOptions = {
  /** When true, returns clientSecret for modal flow (no redirect). When false, returns redirectUrl for hosted flow. */
  useModal?: boolean;
};

/**
 * Creates a Stripe Identity verification session
 * This is the first step in the expert verification process
 *
 * Side effects:
 * - Updates the user record in the database with verification session ID and status
 * - Sets stripeIdentityVerificationLastChecked to current timestamp
 *
 * @param userId - Database user ID
 * @param workosUserId - WorkOS user ID for authentication
 * @param email - User's email address
 * @param options - useModal: when true, returns clientSecret for stripe.verifyIdentity() modal; when false, returns redirectUrl for hosted redirect
 * @returns Response object with success status and session details or error information
 */
export async function createIdentityVerification(
  userId: string,
  workosUserId: string,
  email: string,
  options?: CreateIdentityVerificationOptions,
): Promise<
  | {
      success: true;
      status: string;
      verificationId: string;
      redirectUrl: string | null;
      clientSecret: string | null;
      message: string;
    }
  | {
      success: false;
      error: string;
    }
> {
  const stripe = await getServerStripe();
  const baseUrl = getBaseUrl();

  try {
    // Check if user already has an active verification
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    if (user?.stripeIdentityVerificationId) {
      // Check the status of the existing verification
      const verificationStatus = await getIdentityVerificationStatus(
        user.stripeIdentityVerificationId,
      );

      if (verificationStatus.status === 'verified') {
        return {
          success: true,
          status: verificationStatus.status,
          verificationId: user.stripeIdentityVerificationId,
          redirectUrl: null,
          clientSecret: null,
          message: 'Identity already verified',
        };
      }
    }

    const useModal = options?.useModal ?? true;

    // Create a new verification session
    // Note: Additional verification types like 'id_document_and_selfie' are available
    // for stronger verification if required by compliance needs
    const verificationSession = await stripe.identity.verificationSessions.create(
      {
        type: 'document',
        metadata: {
          userId,
          workosUserId,
          email,
          created_at: new Date().toISOString(),
        },
        // For modal flow, no return_url; for redirect flow, use callback URL
        ...(useModal ? {} : { return_url: `${baseUrl}/account/identity/callback` }),
      },
      { idempotencyKey: `create-verification-${workosUserId}` },
    );

    // Store the verification session ID in the database
    await db
      .update(UsersTable)
      .set({
        stripeIdentityVerificationId: verificationSession.id,
        stripeIdentityVerificationStatus: verificationSession.status,
        stripeIdentityVerificationLastChecked: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(UsersTable.workosUserId, workosUserId));

    return {
      success: true,
      status: verificationSession.status,
      verificationId: verificationSession.id,
      redirectUrl: useModal ? null : verificationSession.url,
      clientSecret: verificationSession.client_secret ?? null,
      message: 'Identity verification created successfully',
    };
  } catch (error) {
    // Log error with masked sensitive details in production
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error creating identity verification:', { maskedError: maskSensitiveData(errorMessage) });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Gets the status of a Stripe Identity verification session
 *
 * @param verificationId - Stripe verification session ID
 * @returns Object containing status information, timestamp, and error details if any
 */
export async function getIdentityVerificationStatus(verificationId: string): Promise<{
  status: string;
  lastUpdated: string | undefined;
  details?: string;
  errorCode?: string;
}> {
  const stripe = await getServerStripe();

  try {
    const verificationSession = await stripe.identity.verificationSessions.retrieve(verificationId);

    // We access the status directly since it's part of the standard API
    const status = verificationSession.status;

    // For timestamps and other properties that might not be properly typed,
    // we use a more specific type definition
    let lastUpdated: string | undefined = undefined;

    // Define more specific types for stripe object properties
    type StripeTimestamp = number;
    interface StripeError {
      message?: string;
      code?: string;
    }

    // Type cast for accessing properties safely
    const stripeSession = verificationSession as Stripe.Identity.VerificationSession & {
      created: StripeTimestamp;
      last_error?: StripeError;
    };

    // Get timestamp
    if (stripeSession.created) {
      lastUpdated = new Date(stripeSession.created * 1000).toISOString();
    }

    return {
      status,
      lastUpdated,
      details: stripeSession.last_error?.message,
      errorCode: stripeSession.last_error?.code,
    };
  } catch (error) {
    logger.error('Error retrieving verification status', {
      error: maskSensitiveData(error),
    });
    throw error;
  }
}

/**
 * Helper function to create a Stripe account link for onboarding
 * Extracted to make the retry mechanism cleaner
 */
async function createAccountLink(
  stripe: Stripe,
  accountId: string,
  baseUrl: string,
): Promise<Stripe.AccountLink> {
  return await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/account/billing?refresh=true`,
    return_url: `${baseUrl}/account/billing?success=true`,
    type: 'account_onboarding',
    collect: 'eventually_due',
  });
}

/**
 * Creates a Connect account using verified identity information
 * This should be called after identity verification is complete
 *
 * Side effects:
 * - Creates a Stripe Connect account if one doesn't exist
 * - Updates the user record in the database with Connect account ID and status
 *
 * @param workosUserId - WorkOS user ID for authentication
 * @param email - User's email address
 * @param country - Two-letter country code
 * @returns Response object with success status and account details or error information
 */
export async function createConnectAccountWithVerifiedIdentity(
  workosUserId: string,
  email: string,
  country: string,
): Promise<
  | {
      success: true;
      accountId: string;
      detailsSubmitted: boolean;
      onboardingUrl: string;
    }
  | {
      success: false;
      error: string;
    }
> {
  const stripe = await getServerStripe();
  const baseUrl = getBaseUrl();

  // Validate country code against supported Stripe Connect countries
  const validCountryCodes = STRIPE_CONNECT_SUPPORTED_COUNTRIES;

  const countryCode = country.toUpperCase();
  // Type assertion to make TypeScript happy with the readonly array
  if (!(validCountryCodes as readonly string[]).includes(countryCode)) {
    logError('Invalid country code', { workosUserId, email, country });
    return {
      success: false,
      error: `Invalid country code: ${country}. Must be one of: ${validCountryCodes.join(', ')}`,
    };
  }

  try {
    // Get the user from the database
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
    });

    if (!user) {
      logError('User not found', { workosUserId, email });
      throw new Error('User not found');
    }

    // Check if the user has a verified identity
    if (!user.stripeIdentityVerificationId) {
      logError('User has not completed identity verification', { workosUserId, userId: user.id });
      throw new Error('User has not completed identity verification');
    }

    // Get verification status
    const verificationStatus = await getIdentityVerificationStatus(
      user.stripeIdentityVerificationId,
    );

    if (verificationStatus.status !== 'verified') {
      logError('Identity verification is not complete', {
        workosUserId,
        userId: user.id,
        status: verificationStatus.status,
      });
      throw new Error(`Identity verification is not complete: ${verificationStatus.status}`);
    }

    // Step 1: Check if account already exists to avoid duplication
    if (user.stripeConnectAccountId) {
      // Get account details from Stripe to verify it's valid
      try {
        const existingAccount = await stripe.accounts.retrieve(user.stripeConnectAccountId);

        // If account exists and is active, create a new account link
        if (existingAccount.id) {
          const accountLink = await stripe.accountLinks.create({
            account: existingAccount.id,
            refresh_url: `${baseUrl}/account/billing?refresh=true`,
            return_url: `${baseUrl}/account/billing?success=true`,
            type: 'account_onboarding',
            collect: 'eventually_due',
          });

          return {
            success: true,
            accountId: existingAccount.id,
            detailsSubmitted: existingAccount.details_submitted,
            onboardingUrl: accountLink.url,
          };
        }
      } catch (error: unknown) {
        // If the existing account ID is invalid, we'll create a new one
        logError('Existing Connect account not found in Stripe', {
          workosUserId,
          accountId: user.stripeConnectAccountId,
          error,
        });
      }
    }

    // Step 2: Create the Connect account using the verified identity
    let account: Stripe.Account;
    try {
      account = await stripe.accounts.create(
        {
          type: 'express',
          country: countryCode,
          email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          settings: {
            payouts: {
              schedule: {
                interval: 'daily',
                delay_days: getMinimumPayoutDelay(countryCode),
              },
            },
          },
          metadata: {
            workosUserId,
            identity_verified: 'true',
            identity_verified_at: new Date().toISOString(),
            identity_verification_id: user.stripeIdentityVerificationId,
          },
        },
        { idempotencyKey: `create-connect-verified-${workosUserId}` },
      );
    } catch (error) {
      logError('Failed to create Stripe Connect account', { workosUserId, email, country, error });
      throw error;
    }

    // Step 3: Update the user record with the Connect account ID
    try {
      await db
        .update(UsersTable)
        .set({
          stripeConnectAccountId: account.id,
          stripeConnectDetailsSubmitted: account.details_submitted,
          stripeConnectPayoutsEnabled: account.payouts_enabled,
          stripeConnectChargesEnabled: account.charges_enabled,
          updatedAt: new Date(),
        })
        .where(eq(UsersTable.workosUserId, workosUserId));
    } catch (dbError) {
      // If database update fails, we should delete the Stripe account to maintain consistency
      logError('Failed to update user record with Connect account', {
        workosUserId,
        accountId: account.id,
        error: dbError,
      });

      try {
        // Attempt to delete the created account to avoid orphaned accounts
        await stripe.accounts.del(account.id);
      } catch (deleteError) {
        logError('Failed to delete orphaned Connect account after DB update failure', {
          workosUserId,
          accountId: account.id,
          error: deleteError,
        });
      }

      throw dbError;
    }

    // Step 4: Create account link for onboarding
    let accountLink: Stripe.AccountLink;
    try {
      accountLink = await createAccountLink(stripe, account.id, baseUrl);
    } catch (linkError: unknown) {
      logError('Failed to create account link for onboarding', {
        workosUserId,
        accountId: account.id,
        error: linkError,
      });

      // Implement a simple retry mechanism
      try {
        // Wait a moment before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
        logError('Retrying account link creation after failure', {
          workosUserId,
          accountId: account.id,
        });

        accountLink = await createAccountLink(stripe, account.id, baseUrl);

        // If we reach here, retry succeeded
        return {
          success: true,
          accountId: account.id,
          detailsSubmitted: account.details_submitted,
          onboardingUrl: accountLink.url,
        };
      } catch (retryError) {
        logError('Failed to create account link after retry', {
          workosUserId,
          accountId: account.id,
          error: retryError,
        });
        // We don't delete the account here since it was successfully created and saved to DB
        // The user can try again later to get an onboarding link
        throw linkError;
      }
    }

    return {
      success: true,
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      onboardingUrl: accountLink.url,
    };
  } catch (error) {
    logError('Error creating Connect account with verified identity', {
      workosUserId,
      email,
      country,
      error,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Central logging function for Stripe operations
 */
function logError(message: string, context: Record<string, unknown>): void {
  const maskedContext = maskSensitiveData(context);
  logger.error(`[STRIPE] ${message}`, maskedContext as Record<string, unknown>);
  if (context.error instanceof Error) {
    Sentry.captureException(context.error, { extra: maskedContext as Record<string, unknown> });
  }
}

/**
 * Masks potentially sensitive data in error objects and log contexts
 * to prevent leaking PII in logs
 */
function maskSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    // Mask potential sensitive patterns in strings
    return data
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD_REDACTED]') // Credit card patterns
      .replace(/sk_(?:test|live)_[a-zA-Z0-9]{24,}/g, '[STRIPE_KEY_REDACTED]');
  }

  if (data instanceof Error) {
    const { message, name } = data;
    return { name, message: maskSensitiveData(message), stack: '[STACK_TRACE_REDACTED]' };
  }

  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {};

    // Handle array case
    if (Array.isArray(data)) {
      return data.map(maskSensitiveData);
    }

    // Handle object case
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields entirely
      if (['password', 'secret', 'token', 'key', 'ssn', 'tax_id'].includes(key.toLowerCase())) {
        result[key] = '[REDACTED]';
        continue;
      }

      // Recursively mask nested objects
      result[key] = maskSensitiveData(value);
    }

    return result;
  }

  return data;
}
