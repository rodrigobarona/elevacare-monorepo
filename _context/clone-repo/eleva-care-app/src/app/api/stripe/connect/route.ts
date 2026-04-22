import * as Sentry from '@sentry/nextjs';
import { getMinimumPayoutDelay, STRIPE_CONNECT_SUPPORTED_COUNTRIES } from '@/config/stripe';
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import {
  createStripeConnectAccount,
  getConnectAccountBalance,
  getStripeConnectSetupOrLoginLink,
} from '@/lib/integrations/stripe';
import { isStripeError } from '@/types/stripe-errors';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return Sentry.startSpan(
    {
      name: 'stripe.connect.create',
      op: 'api.route',
    },
    async (span) => {
      try {
        const { user } = await withAuth();
        const userId = user?.id;
        if (!user || !userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        span.setAttribute('stripe.workos_user_id', userId);

        let email: string;
        let country: string;

        try {
          const body = await request.json();
          email = body.email;
          country = body.country;

          if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
          }

          // Default country to PT if not provided
          if (!country) {
            Sentry.logger.debug('Country not provided, defaulting to PT', { userId });
            country = 'PT';
          }
        } catch (parseError) {
          Sentry.logger.error('Error parsing request body', {
            userId,
            error: parseError instanceof Error ? parseError.message : 'Unknown error',
          });
          return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
        }

        // Normalize country code (uppercase)
        const normalizedCountry = country.toUpperCase();

        // Validate country against supported list
        const isCountrySupported = STRIPE_CONNECT_SUPPORTED_COUNTRIES.includes(
          normalizedCountry as (typeof STRIPE_CONNECT_SUPPORTED_COUNTRIES)[number],
        );

        if (!isCountrySupported) {
          Sentry.logger.warn('Unsupported country provided for Connect account', {
            providedCountry: country,
            normalizedCountry,
            userId,
          });

          // Instead of silently defaulting to PT, return an informative error
          return NextResponse.json(
            {
              error: 'Country not supported',
              message: `The country "${country}" is not supported for Stripe Connect accounts. Please select a supported country.`,
              supportedCountries: STRIPE_CONNECT_SUPPORTED_COUNTRIES,
              suggestedCountry: 'PT', // Still suggest PT as a fallback
            },
            { status: 400 },
          );
        }

        // At this point we know the country is supported and normalized
        country = normalizedCountry;
        span.setAttribute('stripe.connect.country', country);

        Sentry.logger.info('Creating Connect account', { userId, country });

        // Check if user already has a Connect account
        const dbUser = await db.query.UsersTable.findFirst({
          where: eq(UsersTable.workosUserId, userId),
        });

        if (!dbUser) {
          return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
        }

        // Check if user is identity verified before allowing Connect account creation
        if (!dbUser.stripeIdentityVerified) {
          Sentry.logger.warn('Connect account creation blocked - identity verification required', {
            userId,
          });
          return NextResponse.json(
            {
              error: 'Identity verification required',
              redirectTo: '/account/identity',
              message: 'Please complete identity verification before creating a Connect account',
            },
            { status: 403 },
          );
        }

        if (dbUser.stripeConnectAccountId) {
          // User already has a Connect account, return the setup/login link
          span.setAttribute('stripe.connect.existing_account', true);
          span.setAttribute('stripe.connect_account_id', dbUser.stripeConnectAccountId);
          try {
            const url = await getStripeConnectSetupOrLoginLink(dbUser.stripeConnectAccountId);
            Sentry.logger.info('Returning existing Connect account setup link', {
              userId,
              accountId: dbUser.stripeConnectAccountId,
            });
            return NextResponse.json({ url });
          } catch (error) {
            Sentry.logger.warn(
              'Failed to get existing Connect account link, creating new account',
              {
                userId,
                accountId: dbUser.stripeConnectAccountId,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            );
            // If the Connect account exists but we can't get a link, create a new one
          }
        }

        // Create a new Connect account with retry logic
        const maxRetries = 3;
        let accountId = '';
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            Sentry.logger.debug(
              `Creating Stripe Connect account attempt ${attempt}/${maxRetries}`,
              {
                userId,
                country,
              },
            );
            const result = await createStripeConnectAccount(email, country);
            accountId = result.accountId;

            // Break the loop if successful
            if (accountId) break;
          } catch (error) {
            Sentry.logger.error(`Connect account creation attempt ${attempt} failed`, {
              userId,
              country,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            lastError = error;

            // Check for specific error types to provide better feedback
            if (isStripeError(error)) {
              // Use the type guard to verify this is a StripeError
              const stripeError = error;

              // Specific handling for payout schedule errors
              if (
                stripeError.raw?.param?.includes('payouts') ||
                stripeError.raw?.param?.includes('delay_days')
              ) {
                Sentry.logger.warn('Encountered payout schedule error', {
                  userId,
                  country,
                  stripeErrorCode: stripeError.raw?.code,
                });

                // Get the minimum delay required for this country
                const minimumDelay = getMinimumPayoutDelay(country);

                // Return a specific error for payout schedule issues
                return NextResponse.json(
                  {
                    error: 'Payout schedule error',
                    message: `Unable to set the requested payout schedule. Stripe requires a minimum ${minimumDelay}-day delay for new accounts in ${country}.`,
                    details: stripeError.raw?.message || stripeError.message,
                    code: stripeError.raw?.code,
                    minimumDelayDays: minimumDelay,
                    country: country,
                  },
                  { status: 400 },
                );
              }
            }

            // If not the last attempt, wait before retrying
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
          }
        }

        // If all attempts failed, return error
        if (!accountId) {
          // Safely handle the error object
          const errorDetails = (() => {
            if (isStripeError(lastError)) {
              // It's a valid Stripe error
              return {
                details: lastError.message || 'Stripe API error',
                code: lastError.raw?.code || lastError.code,
                param: lastError.raw?.param,
                type: lastError.type,
              };
            }

            if (lastError instanceof Error) {
              // It's a standard Error object
              return {
                details: lastError.message,
                stack: process.env.NODE_ENV === 'development' ? lastError.stack : undefined,
              };
            }

            // Unknown error type
            return {
              details: 'Unknown error occurred',
            };
          })();

          Sentry.logger.error('Failed to create Connect account after multiple attempts', {
            userId,
            country,
            errorDetails,
          });

          // Provide a detailed error response based on what went wrong
          return NextResponse.json(
            {
              error: 'Failed to create Connect account after multiple attempts',
              ...errorDetails,
              suggestion: 'Please try again or contact support if the issue persists.',
            },
            { status: 500 },
          );
        }

        // Update user record with Connect account ID
        await db
          .update(UsersTable)
          .set({
            stripeConnectAccountId: accountId,
            updatedAt: new Date(),
          })
          .where(eq(UsersTable.workosUserId, userId));

        // Get the setup link for the new account
        const url = await getStripeConnectSetupOrLoginLink(accountId);

        span.setAttribute('stripe.connect_account_id', accountId);
        span.setAttribute('stripe.connect.created', true);
        Sentry.logger.info('Connect account created successfully', { userId, accountId, country });

        return NextResponse.json({ accountId, url });
      } catch (error) {
        Sentry.logger.error('Error in Connect account creation', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // More robust error handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
          {
            error: 'Failed to create Connect account',
            details: errorMessage,
            suggestion: 'Please check your information and try again later.',
          },
          { status: 500 },
        );
      }
    },
  );
}

export async function GET() {
  return Sentry.startSpan(
    {
      name: 'stripe.connect.balance',
      op: 'api.route',
    },
    async (span) => {
      try {
        const { user } = await withAuth();
        const userId = user?.id;
        if (!user || !userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        span.setAttribute('stripe.workos_user_id', userId);

        const dbUser = await db.query.UsersTable.findFirst({
          where: eq(UsersTable.workosUserId, userId),
        });

        if (!dbUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (!dbUser.stripeConnectAccountId) {
          return NextResponse.json({ error: 'No Connect account found' }, { status: 404 });
        }

        span.setAttribute('stripe.connect_account_id', dbUser.stripeConnectAccountId);

        const balance = await getConnectAccountBalance(dbUser.stripeConnectAccountId);

        Sentry.logger.debug('Connect account balance fetched', {
          userId,
          accountId: dbUser.stripeConnectAccountId,
        });

        return NextResponse.json({ balance });
      } catch (error) {
        Sentry.logger.error('Error fetching Connect account balance', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Failed to fetch Connect account balance',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 },
        );
      }
    },
  );
}
