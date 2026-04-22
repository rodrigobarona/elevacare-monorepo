import { ENV_CONFIG } from '@/config/env';
import { PAYOUT_DELAY_DAYS } from '@/config/stripe';
import { db } from '@/drizzle/db';
import { PaymentTransfersTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import {
  sendHeartbeatFailure,
  sendHeartbeatSuccess,
} from '@/lib/integrations/betterstack/heartbeat';
import { createUpcomingPayoutNotification } from '@/lib/notifications/payment';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { getFullUserByWorkosId as getUserByWorkosId } from '@/server/db/users';
import { addDays, differenceInDays } from 'date-fns';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// Check Upcoming Payouts - Notifies experts about upcoming eligible payouts
// Performs the following tasks:
// - Identifies pending transfers without notifications
// - Calculates remaining days until payout based on country rules
// - Sends notifications for payouts eligible in 1-2 days
// - Updates notification timestamps
// - Maintains notification audit trail

export const maxDuration = 60;

// This CRON job runs daily and checks for payments that will be eligible for payout soon
// It sends notifications to experts about upcoming payouts
async function handler(request: Request) {
  logger.info('Starting check for upcoming payouts...');

  try {
    // Get all pending transfers that have not been notified yet
    const pendingTransfers = await db
      .select()
      .from(PaymentTransfersTable)
      .where(
        and(
          eq(PaymentTransfersTable.status, 'PENDING'),
          isNull(PaymentTransfersTable.notifiedAt),
          isNull(PaymentTransfersTable.transferId),
        ),
      );

    logger.info(
      logger.fmt`Found ${pendingTransfers.length} pending transfers to check for upcoming payout notifications`,
    );

    const results = {
      notifications_sent: 0,
      errors: 0,
    };

    // Process each pending transfer
    for (const transfer of pendingTransfers) {
      try {
        // Get the expert's country to determine payout delay
        const expert = await getUserByWorkosId(transfer.expertWorkosUserId);
        if (!expert || !expert.country) {
          logger.info(
            logger.fmt`Expert ${transfer.expertWorkosUserId} not found or has no country set, skipping notification`,
          );
          continue;
        }

        // Get country-specific payout delay with proper case handling
        const countryCode = expert.country.toUpperCase() as keyof typeof PAYOUT_DELAY_DAYS;
        const countryDelay = PAYOUT_DELAY_DAYS[countryCode] || PAYOUT_DELAY_DAYS.DEFAULT;
        const paymentDate = transfer.created || new Date();
        const daysAged = differenceInDays(new Date(), paymentDate);
        const remainingDays = Math.max(0, countryDelay - daysAged);

        // If payment will be eligible for payout in 1-2 days, send notification
        if (remainingDays <= 2 && remainingDays > 0) {
          const payoutDate = addDays(new Date(), remainingDays);

          // Send notification
          await createUpcomingPayoutNotification({
            userId: transfer.expertWorkosUserId,
            amount: transfer.amount,
            currency: transfer.currency,
            payoutDate,
            eventId: transfer.eventId,
            expert: expert, // Pass the expert user data for email/name
          });

          // Update the transfer record with notification timestamp
          await db
            .update(PaymentTransfersTable)
            .set({
              notifiedAt: new Date(),
              updated: new Date(),
            })
            .where(eq(PaymentTransfersTable.id, transfer.id));

          logger.info(
            logger.fmt`Sent upcoming payout notification to expert ${transfer.expertWorkosUserId} for payment transfer ${transfer.id}`,
          );
          results.notifications_sent++;
        }
      } catch (error) {
        Sentry.captureException(error);
        logger.error(
          logger.fmt`Error processing upcoming payout notification for transfer ${transfer.id}`,
          { error: error instanceof Error ? error.message : String(error) },
        );
        results.errors++;
      }
    }

    logger.info('Completed upcoming payouts check', { results });

    // Send success heartbeat to BetterStack
    await sendHeartbeatSuccess({
      url: ENV_CONFIG.BETTERSTACK_UPCOMING_PAYOUTS_HEARTBEAT,
      jobName: 'Check Upcoming Payouts',
    });

    return NextResponse.json(results);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error in check-upcoming-payouts CRON job', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Send failure heartbeat to BetterStack
    await sendHeartbeatFailure(
      {
        url: ENV_CONFIG.BETTERSTACK_UPCOMING_PAYOUTS_HEARTBEAT,
        jobName: 'Check Upcoming Payouts',
      },
      error,
    );

    return NextResponse.json({ error: 'Failed to process upcoming payouts' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
