import * as Sentry from '@sentry/nextjs';
import { STRIPE_CONNECT_SUPPORTED_COUNTRIES } from '@/config/stripe';
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import { createConnectAccountWithVerifiedIdentity } from '@/lib/integrations/stripe/identity';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Email validation schema
const emailSchema = z.string().email({
  message: 'Invalid email address format',
});

// Zod schema for request validation
const createConnectAccountSchema = z
  .object({
    country: z.enum(STRIPE_CONNECT_SUPPORTED_COUNTRIES, {
      error: 'Country must be a valid ISO 3166-1 alpha-2 code',
    }),
  })
  .strict();

type CreateConnectAccountRequest = z.infer<typeof createConnectAccountSchema>;

/**
 * POST /api/stripe/connect/create
 *
 * Creates a Stripe Connect account for the current user
 * This endpoint requires the user to have completed identity verification first
 *
 * @returns 200 - Success with onboarding URL
 * @returns 401 - Unauthorized if no user is authenticated
 * @returns 404 - User not found in database
 * @returns 422 - Invalid request body, unsupported country code, or invalid email
 * @returns 409 - Identity verification incomplete or Connect account already exists
 * @returns 500 - Server error during Connect account creation
 */
export async function POST(request: Request) {
  return Sentry.startSpan(
    {
      name: 'stripe.connect.create_with_identity',
      op: 'api.route',
    },
    async (span) => {
      try {
        const { user } = await withAuth();
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        span.setAttribute('stripe.workos_user_id', user.id);

        // Get user record from database
        const dbUser = await db.query.UsersTable.findFirst({
          where: eq(UsersTable.workosUserId, user.id),
        });

        if (!dbUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Validate request body
        let body: CreateConnectAccountRequest;
        try {
          const rawBody = await request.json();
          body = createConnectAccountSchema.parse(rawBody);
        } catch (error) {
          Sentry.logger.error('Error validating request body for Connect account', {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (error instanceof z.ZodError) {
            return NextResponse.json(
              {
                error: 'Invalid request body',
                details: error.issues.map((e) => ({
                  field: e.path.join('.'),
                  message: e.message,
                })),
              },
              { status: 422 },
            );
          }

          return NextResponse.json(
            {
              error: 'Invalid request body',
              details: 'Request body must be valid JSON with required fields',
            },
            { status: 422 },
          );
        }

        span.setAttribute('stripe.connect.country', body.country);

        // Get and validate email from WorkOS user or database
        let email: string;
        try {
          // Try WorkOS email first
          const workosEmail = user.email;
          if (workosEmail) {
            email = emailSchema.parse(workosEmail);
          } else if (dbUser.email) {
            // Fallback to database email
            email = emailSchema.parse(dbUser.email);
          } else {
            throw new Error('No valid email found');
          }
        } catch (error) {
          Sentry.logger.error('Error validating user email for Connect account', {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return NextResponse.json(
            {
              error: 'Invalid email',
              details: 'A valid email address is required to create a Stripe Connect account',
            },
            { status: 422 },
          );
        }

        Sentry.logger.info('Creating Connect account with verified identity', {
          userId: user.id,
          country: body.country,
        });

        // Create Connect account with verified identity
        const result = await createConnectAccountWithVerifiedIdentity(user.id, email, body.country);

        if (!result.success) {
          // Determine appropriate error status based on the error type
          if (result.error?.includes('identity verification')) {
            Sentry.logger.warn(
              'Connect account creation blocked - identity verification required',
              {
                userId: user.id,
                error: result.error,
              },
            );
            return NextResponse.json(
              {
                error: result.error,
                details: 'Complete identity verification before creating a Connect account',
              },
              { status: 409 },
            );
          }
          if (result.error?.includes('already exists')) {
            Sentry.logger.info('Connect account already exists', {
              userId: user.id,
            });
            return NextResponse.json(
              { error: result.error, details: 'Connect account already exists for this user' },
              { status: 409 },
            );
          }
          Sentry.logger.error('Failed to create Connect account with verified identity', {
            userId: user.id,
            error: result.error,
          });
          return NextResponse.json(
            { error: result.error, details: 'Failed to create Connect account' },
            { status: 422 },
          );
        }

        span.setAttribute('stripe.connect.created', true);
        if (result.accountId) {
          span.setAttribute('stripe.connect_account_id', result.accountId);
        }

        Sentry.logger.info('Connect account created successfully with verified identity', {
          userId: user.id,
          accountId: result.accountId,
          country: body.country,
        });

        return NextResponse.json(result);
      } catch (error) {
        Sentry.logger.error('Error creating Connect account with verified identity', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          { error: 'Failed to create Connect account', details: 'An unexpected error occurred' },
          { status: 500 },
        );
      }
    },
  );
}
