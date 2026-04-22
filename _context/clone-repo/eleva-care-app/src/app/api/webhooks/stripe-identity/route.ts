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

// Handle POST requests from Stripe webhooks
export async function POST(request: Request) {
  let eventType = 'unknown';
  let eventId = 'unknown';

  try {
    // Log the request info (useful for debugging)
    logger.info('Received webhook request to /api/webhooks/stripe-identity');

    if (!process.env.STRIPE_IDENTITY_WEBHOOK_SECRET) {
      logger.error('Missing STRIPE_IDENTITY_WEBHOOK_SECRET environment variable');
      throw new Error('Missing STRIPE_IDENTITY_WEBHOOK_SECRET environment variable');
    }

    // Get the raw body as text
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logger.error('Missing Stripe signature header');
      return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
    }

    const stripe = await getServerStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_IDENTITY_WEBHOOK_SECRET,
      );

      eventType = event.type;
      eventId = event.id;
    } catch (err) {
      logger.error('Webhook signature verification failed:', { error: err });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    logger.info('Received Stripe Identity webhook event:', {
      type: event.type,
      id: event.id,
      timestamp: new Date().toISOString(),
    });

    // Handle identity verification events
    if (event.type.startsWith('identity.verification_session')) {
      await handleVerificationSessionEvent(event);
    }

    return NextResponse.json({ received: true, status: 'success' });
  } catch (error) {
    logger.error('Error processing webhook:', {
      error,
      eventType,
      eventId,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 },
    );
  }
}

async function handleVerificationSessionEvent(event: Stripe.Event) {
  try {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const verificationId = session.id;

    logger.info('Processing verification session event:', {
      sessionId: verificationId,
      status: session.status,
      eventType: event.type,
      metadata: session.metadata,
      verificationFlow: session.verification_flow || 'No verification flow specified',
    });

    // Try to find user by verification ID first
    let user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.stripeIdentityVerificationId, verificationId),
    });

    // If no user found by verification ID, check metadata for workosUserId
    if (!user && session.metadata && session.metadata.workosUserId) {
      const workosUserId = session.metadata.workosUserId as string;
      logger.info('Looking up user by WorkOS ID from metadata:', { workosUserId });

      user = await db.query.UsersTable.findFirst({
        where: eq(UsersTable.workosUserId, workosUserId),
      });

      // If we found a user, update their verification ID
      if (user) {
        await db
          .update(UsersTable)
          .set({
            stripeIdentityVerificationId: verificationId,
            updatedAt: new Date(),
          })
          .where(eq(UsersTable.id, user.id));
      }
    }

    if (!user) {
      logger.error('No user found for verification session:', {
        verificationId,
        metadata: session.metadata,
      });
      return;
    }

    // Use status from the webhook event directly instead of making a redundant API call
    const isVerified = session.status === 'verified';

    await db
      .update(UsersTable)
      .set({
        stripeIdentityVerified: isVerified,
        stripeIdentityVerificationStatus: session.status,
        stripeIdentityVerificationLastChecked: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(UsersTable.id, user.id));

    logger.info('Updated user verification status:', {
      userId: user.id,
      workosUserId: user.workosUserId,
      status: session.status,
      lastChecked: new Date().toISOString(),
      verificationFlow: session.verification_flow || 'Standard flow',
    });

    // If verification is verified, add to expert onboarding progress
    if (isVerified) {
      try {
        // Note: markStepComplete now gets user from auth context
        // For webhooks, expert setup completion should be tracked separately
        logger.info(`Identity verification completed for user ${user.workosUserId}`);

        // Now sync the identity verification to the Connect account if it exists
        try {
          // Check if user has a Connect account first
          if (!user.stripeConnectAccountId) {
            logger.info('User has no Connect account yet, skipping sync:', { workosUserId: user.workosUserId });
            return;
          }

          // Retry the sync up to 3 times with exponential backoff
          let syncSuccess = false;
          let lastError: Error | null = null;

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              logger.info(
                `Syncing identity verification attempt ${attempt} for user ${user.workosUserId}`,
              );

              const { syncIdentityVerificationToConnect } = await import(
                '@/lib/integrations/stripe'
              );
              const result = await syncIdentityVerificationToConnect(user.workosUserId);

              if (result.success) {
                logger.info(
                  `Successfully synced identity verification to Connect account for user ${user.workosUserId}`,
                  {
                    attempt,
                    verificationStatus: result.verificationStatus,
                  },
                );
                syncSuccess = true;
                break;
              } else {
                logger.info(`Sync attempt ${attempt} failed: ${result.message}`);
                lastError = new Error(result.message);

                // Wait before retrying (linear backoff)
                if (attempt < 3) {
                  const delay = attempt * 1000; // 1s, 2s
                  await new Promise((resolve) => setTimeout(resolve, delay));
                }
              }
            } catch (syncError) {
              logger.error(`Error in sync attempt ${attempt}:`, { error: syncError });
              lastError = syncError instanceof Error ? syncError : new Error('Unknown error');

              // Wait before retrying (linear backoff)
              if (attempt < 3) {
                const delay = attempt * 1000; // 1s, 2s
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }

          // Log outcome after all attempts
          if (!syncSuccess) {
            logger.error('All attempts to sync identity verification failed:', {
              userId: user.id,
              workosUserId: user.workosUserId,
              errorMessage: lastError?.message || 'Unknown error',
            });
          }
        } catch (syncError) {
          logger.error('Unhandled error in identity sync process:', { error: syncError });
        }
      } catch (error) {
        logger.error('Failed to mark identity step as complete:', { error });
      }
    }
  } catch (error) {
    logger.error('Error handling verification session event:', { error });
    throw error;
  }
}
