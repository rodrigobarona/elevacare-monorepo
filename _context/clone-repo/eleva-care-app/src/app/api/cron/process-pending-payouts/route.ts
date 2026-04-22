import { ENV_CONFIG } from '@/config/env';
import { db } from '@/drizzle/db';
import {
  EventsTable,
  MeetingsTable,
  PaymentTransfersTable,
  UsersTable,
} from '@/drizzle/schema';
import {
  PAYMENT_TRANSFER_STATUS_COMPLETED,
  PAYMENT_TRANSFER_STATUS_PAID_OUT,
} from '@/lib/constants/payment-transfers';
import {
  sendHeartbeatFailure,
  sendHeartbeatSuccess,
} from '@/lib/integrations/betterstack/heartbeat';
import * as Sentry from '@sentry/nextjs';
import { getServerStripe } from '@/lib/integrations/stripe';
import { createPayoutCompletedNotification } from '@/lib/notifications/payment';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const { logger } = Sentry;

// Enhanced Process Pending Payouts - Creates actual Stripe payouts after legal requirements
// This cron job handles the final phase of expert payments with comprehensive verification:
// 1. Database Phase: Finds completed transfers where appointment ended 24+ hours ago
// 2. Stripe Fallback Phase: Checks all Connect accounts for overdue payouts per legal requirements
// 3. Creates Stripe payouts from Connect account to expert bank account
// 4. Updates records and sends notifications

export const maxDuration = 300; // Increased to 5 minutes for comprehensive checks

// Legal requirements based on Stripe Connect best practices
const APPOINTMENT_COMPLAINT_WINDOW_HOURS = 24; // Post-appointment dispute window (Airbnb-style)

// Define types for database entities
type PaymentTransfer = typeof PaymentTransfersTable.$inferSelect;
type User = typeof UsersTable.$inferSelect;

// Define types for payout results
type SuccessResult = {
  success: true;
  payoutId: string;
  paymentTransferId?: number;
  connectAccountId: string;
  amount: number;
  currency: string;
  source: 'database' | 'stripe_fallback';
};

type ErrorResult = {
  success: false;
  paymentTransferId?: number;
  connectAccountId: string;
  error: string;
  retryCount: number;
  source: 'database' | 'stripe_fallback';
};

type PayoutResult = SuccessResult | ErrorResult;

// Type for the expert user data needed for payouts
// Note: firstName/lastName removed (Phase 5) - use username or fetch from WorkOS API if needed
type ExpertUserForPayout = {
  workosUserId: string;
  username: string | null;
  email: string;
  stripeConnectAccountId: string | null;
};

/**
 * Enhanced Payout Processing with Database + Stripe Fallback Verification
 * This endpoint is called by QStash daily at 6 AM
 *
 * Phase 1: Database-driven payouts (preferred method)
 * Phase 2: Stripe fallback for legal compliance verification
 */
async function handler(_request: Request) {
  const now = new Date();
  let databaseResults: PayoutResult[] = [];
  let stripeResults: PayoutResult[] = [];
  const stripe = await getServerStripe();

  try {
    logger.info('Starting Enhanced Payout Processing', { timestamp: now.toISOString() });

    // ================================================================================
    // PHASE 1: DATABASE-DRIVEN PAYOUT PROCESSING (Primary Method)
    // ================================================================================
    logger.info('PHASE 1: Processing database-tracked completed transfers...');

    // Find completed transfers that don't have payouts yet
    const completedTransfers = await db.query.PaymentTransfersTable.findMany({
      where: and(
        eq(PaymentTransfersTable.status, PAYMENT_TRANSFER_STATUS_COMPLETED),
        isNull(PaymentTransfersTable.payoutId), // No payout created yet
      ),
      orderBy: desc(PaymentTransfersTable.created),
    });

    logger.info(logger.fmt`Found ${completedTransfers.length} completed transfers to evaluate for payout`);

    // Filter transfers based on appointment completion + complaint window requirements
    const eligibleForPayout = [];
    for (const transfer of completedTransfers) {
      try {
        // Get expert user to determine their country and payout delay
        const expertUser = await db.query.UsersTable.findFirst({
          where: eq(UsersTable.workosUserId, transfer.expertWorkosUserId),
        });

        if (!expertUser) {
          logger.error(
            logger.fmt`Could not find expert user ${transfer.expertWorkosUserId} for transfer ${transfer.id}`,
          );
          continue;
        }

        if (!expertUser.stripeConnectAccountId) {
          logger.error(
            logger.fmt`Expert user ${transfer.expertWorkosUserId} has no Connect account for transfer ${transfer.id}`,
          );
          continue;
        }

        // Get event details to calculate appointment end time
        const event = await db.query.EventsTable.findFirst({
          where: eq(EventsTable.id, transfer.eventId),
          columns: { durationInMinutes: true },
        });

        if (!event) {
          logger.error(logger.fmt`Could not find event ${transfer.eventId} for transfer ${transfer.id}`);
          continue;
        }

        // Calculate appointment end time
        const appointmentEndTime = new Date(
          transfer.sessionStartTime.getTime() + event.durationInMinutes * 60 * 1000,
        );

        // Calculate hours since appointment ended (24+ hours for complaint window)
        const hoursSinceAppointmentEnd = Math.floor(
          (now.getTime() - appointmentEndTime.getTime()) / (1000 * 60 * 60),
        );

        logger.info(
          logger.fmt`Transfer ${transfer.id}: Appointment ended ${hoursSinceAppointmentEnd}h ago (required: ${APPOINTMENT_COMPLAINT_WINDOW_HOURS}h), appointment end: ${appointmentEndTime.toISOString()}`,
        );

        // Check if complaint window has passed (24+ hours since appointment ended)
        if (hoursSinceAppointmentEnd >= APPOINTMENT_COMPLAINT_WINDOW_HOURS) {
          eligibleForPayout.push({
            ...transfer,
            expertUser,
            appointmentEndTime,
            hoursSinceAppointmentEnd,
          });
          logger.info(
            logger.fmt`Transfer ${transfer.id} eligible for payout: appointment ended ${hoursSinceAppointmentEnd}h ago`,
          );
        } else {
          logger.info(
            logger.fmt`Transfer ${transfer.id} not ready for payout: only ${hoursSinceAppointmentEnd}h since appointment ended (need ${APPOINTMENT_COMPLAINT_WINDOW_HOURS}h)`,
          );
        }
      } catch (error) {
        Sentry.captureException(error);
        logger.error(logger.fmt`Error evaluating payout eligibility for transfer ${transfer.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info(logger.fmt`Found ${eligibleForPayout.length} transfers eligible for payout creation`);

    // Process each eligible transfer
    databaseResults = await Promise.allSettled(
      eligibleForPayout.map(async (transferData) => {
        const { expertUser, ...transfer } = transferData;
        logger.info(logger.fmt`Creating payout for transfer: ${transfer.id}`);

        try {
          const result = await createPayoutForTransfer(transfer, expertUser, 'database');

          if (result.success) {
            // Update the transfer record with payout information
            await db
              .update(PaymentTransfersTable)
              .set({
                payoutId: result.payoutId,
                status: PAYMENT_TRANSFER_STATUS_PAID_OUT,
                updated: new Date(),
              })
              .where(eq(PaymentTransfersTable.id, transfer.id));

            // Send notification with real appointment data
            await sendPayoutNotification(transfer, expertUser, result.payoutId);
          }

          return result;
        } catch (error) {
          Sentry.captureException(error);
          logger.error(logger.fmt`Error processing transfer ${transfer.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            paymentTransferId: transfer.id,
            connectAccountId: expertUser.stripeConnectAccountId!,
            error: (error as Error).message,
            retryCount: 0,
            source: 'database' as const,
          };
        }
      }),
    ).then((results) =>
      results.map((result) => (result.status === 'fulfilled' ? result.value : result.reason)),
    );

    // ================================================================================
    // PHASE 2: STRIPE FALLBACK VERIFICATION (Legal Compliance Safety Net)
    // ================================================================================
    logger.info('PHASE 2: Stripe fallback verification for legal compliance...');

    // Get all users with Connect accounts (these are experts who can receive payouts)
    const expertUsers = await db.query.UsersTable.findMany({
      where: isNotNull(UsersTable.stripeConnectAccountId), // Has a Connect account
      columns: {
        workosUserId: true,
        stripeConnectAccountId: true,
        username: true,
        email: true,
      },
    });

    const connectAccountIds = expertUsers
      .filter((user) => user.stripeConnectAccountId)
      .map((user) => user.stripeConnectAccountId!);

    logger.info(logger.fmt`Checking ${connectAccountIds.length} Connect accounts for overdue balances...`);

    // Get accounts that already had payouts processed in Phase 1 to avoid duplicates
    const processedAccountIds = databaseResults
      .filter((result): result is SuccessResult => result.success)
      .map((result) => result.connectAccountId);

    // Check Connect accounts that weren't processed in Phase 1
    const unprocessedAccountIds = connectAccountIds.filter(
      (accountId) => !processedAccountIds.includes(accountId),
    );

    logger.info(logger.fmt`Found ${unprocessedAccountIds.length} unprocessed Connect accounts to verify`);

    // Check each Connect account for balances that exceed legal holding period
    stripeResults = (await Promise.allSettled(
      unprocessedAccountIds.map(async (accountId) => {
        const expertUser = expertUsers.find((user) => user.stripeConnectAccountId === accountId)!;

        try {
          return await checkConnectAccountForOverdueBalance(stripe, accountId, expertUser);
        } catch (error) {
          Sentry.captureException(error);
          logger.error(logger.fmt`Error checking Connect account ${accountId}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            connectAccountId: accountId,
            error: (error as Error).message,
            retryCount: 0,
            source: 'stripe_fallback' as const,
          };
        }
      }),
    ).then(
      (results) =>
        results
          .map((result) => (result.status === 'fulfilled' ? result.value : result.reason))
          .filter((result) => result !== null), // Filter out null results (no action needed)
    )) as PayoutResult[];

    // ================================================================================
    // SUMMARY AND REPORTING
    // ================================================================================

    // Combine results from both phases
    const results = [...databaseResults, ...stripeResults];

    const successful = results.filter((r): r is SuccessResult => r.success);
    const failed = results.filter((r): r is ErrorResult => !r.success);
    const totalAmountPaidOut = successful.reduce((sum, r) => sum + r.amount, 0);

    const summary = {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      totalAmountPaidOut,
      databasePayouts: databaseResults.filter((r) => r.success).length,
      stripeVerificationPayouts: stripeResults.filter((r) => r.success).length,
      details: results.map((result) => ({
        success: result.success,
        source: result.source,
        connectAccountId: result.connectAccountId,
        amount: result.success ? result.amount : undefined,
        currency: result.success ? result.currency : undefined,
        payoutId: result.success ? result.payoutId : undefined,
        error: !result.success ? result.error : undefined,
      })),
    };

    logger.info('Enhanced Payout Processing Summary', {
      timestamp: now.toISOString(),
      phase1_database: {
        eligible: eligibleForPayout.length,
        processed: databaseResults.length,
        successful: databaseResults.filter((r) => r.success).length,
      },
      phase2_stripe_verification: {
        checked: unprocessedAccountIds.length,
        payouts_created: stripeResults.filter((r) => r.success).length,
      },
      overall: {
        total_payouts: successful.length,
        total_amount: `${totalAmountPaidOut / 100} EUR`,
        failed: failed.length,
      },
    });

    if (failed.length > 0) {
      logger.error('Failed payouts', { failed });
    }

    if (successful.length > 0) {
      logger.info(
        logger.fmt`Successfully created ${successful.length} payouts totaling €${totalAmountPaidOut / 100}`,
      );
    }

    // Send success heartbeat to BetterStack
    await sendHeartbeatSuccess({
      url: ENV_CONFIG.BETTERSTACK_PENDING_PAYOUTS_HEARTBEAT,
      jobName: 'Expert Payout to Bank',
    });

    return NextResponse.json({
      success: true,
      summary,
      enhancedProcessing: {
        databasePhase: {
          eligibleTransfers: eligibleForPayout.length,
          processedTransfers: databaseResults.length,
          successfulPayouts: databaseResults.filter((r) => r.success).length,
        },
        stripeVerificationPhase: {
          checkedAccounts: unprocessedAccountIds.length,
          overduePayouts: stripeResults.filter((r) => r.success).length,
        },
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error in enhanced payout processing', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Send failure heartbeat to BetterStack
    await sendHeartbeatFailure(
      {
        url: ENV_CONFIG.BETTERSTACK_PENDING_PAYOUTS_HEARTBEAT,
        jobName: 'Expert Payout to Bank',
      },
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Enhanced payout processing failed',
        details: (error as Error).message,
        timestamp: now.toISOString(),
      },
      { status: 500 },
    );
  }
}

export const POST = verifySignatureAppRouter(handler);

/**
 * Create a payout for a specific transfer using Stripe Connect best practices
 */
async function createPayoutForTransfer(
  transfer: PaymentTransfer,
  expertUser: User,
  source: 'database' | 'stripe_fallback',
): Promise<PayoutResult> {
  try {
    const stripe = await getServerStripe();
    // Get the Connect account balance to determine payout amount
    const balance = await stripe.balance.retrieve(
      {},
      {
        stripeAccount: expertUser.stripeConnectAccountId!,
      },
    );

    // Find available balance in the transfer currency
    const availableBalance = balance.available.find(
      (bal) => bal.currency === transfer.currency.toLowerCase(),
    );

    if (!availableBalance || availableBalance.amount <= 0) {
      logger.info(
        logger.fmt`No available balance for ${transfer.currency} in account ${expertUser.stripeConnectAccountId}`,
      );
      return {
        success: false,
        paymentTransferId: transfer.id,
        connectAccountId: expertUser.stripeConnectAccountId!,
        error: 'No available balance',
        retryCount: 0,
        source,
      };
    }

    // Create payout for the available amount (or transfer amount, whichever is smaller)
    const payoutAmount = Math.min(availableBalance.amount, transfer.amount);

    const payout = await stripe.payouts.create(
      {
        amount: payoutAmount,
        currency: transfer.currency,
        metadata: {
          paymentTransferId: transfer.id?.toString() || 'stripe_fallback',
          eventId: transfer.eventId || 'unknown',
          expertWorkosUserId: transfer.expertWorkosUserId || expertUser.workosUserId,
          originalTransferAmount: transfer.amount?.toString() || payoutAmount.toString(),
          source,
          processedAt: new Date().toISOString(),
        },
        description: `Expert payout for session ${transfer.eventId || 'verified via Stripe'}`,
      },
      {
        stripeAccount: expertUser.stripeConnectAccountId!,
      },
    );

    logger.info(
      logger.fmt`Successfully created payout ${payout.id} for ${payoutAmount / 100} ${transfer.currency} to expert ${expertUser.workosUserId} (${source})`,
    );

    return {
      success: true,
      payoutId: payout.id,
      paymentTransferId: transfer.id,
      connectAccountId: expertUser.stripeConnectAccountId!,
      amount: payoutAmount,
      currency: transfer.currency,
      source,
    };
  } catch (error) {
    Sentry.captureException(error);
    logger.error(logger.fmt`Error creating payout for transfer ${transfer.id}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      paymentTransferId: transfer.id,
      connectAccountId: expertUser.stripeConnectAccountId!,
      error: (error as Error).message,
      retryCount: 0,
      source,
    };
  }
}

/**
 * Check a Connect account for overdue balances per legal requirements
 * Based on Stripe Connect best practices for legal compliance
 */
async function checkConnectAccountForOverdueBalance(
  stripe: Stripe,
  accountId: string,
  expertUser: ExpertUserForPayout,
): Promise<PayoutResult> {
  try {
    logger.info(logger.fmt`Checking Connect account ${accountId} for overdue balance...`);

    // Get account balance
    const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId });

    if (!balance.available || balance.available.length === 0) {
      logger.info(logger.fmt`No available balance in account ${accountId}`);
      return {
        success: true,
        payoutId: 'none-needed',
        connectAccountId: accountId,
        amount: 0,
        currency: 'eur',
        source: 'stripe_fallback',
      };
    }

    // Check if account has manual payout schedule (requirement for legal compliance)
    const account = await stripe.accounts.retrieve(accountId);
    const payoutSchedule = account.settings?.payouts?.schedule;

    if (payoutSchedule?.interval !== 'manual') {
      logger.info(logger.fmt`Account ${accountId} has automatic payouts enabled, skipping manual check`);
      return {
        success: true,
        payoutId: 'auto-payouts-enabled',
        connectAccountId: accountId,
        amount: 0,
        currency: 'eur',
        source: 'stripe_fallback',
      };
    }

    // Check for balances that exceed maximum holding period
    let overdueAmount = 0;
    let currency = 'eur';

    for (const balanceItem of balance.available) {
      if (balanceItem.amount > 0) {
        // For legal compliance, we need to check when funds were last received
        // Since we can't easily determine exact ages from balance, we use a conservative approach:
        // If there's a significant balance (>€10) and manual payouts are enabled,
        // we should create a payout to ensure compliance

        const minimumPayoutThreshold = 1000; // €10.00 in cents

        if (balanceItem.amount >= minimumPayoutThreshold) {
          overdueAmount += balanceItem.amount;
          currency = balanceItem.currency;
        }
      }
    }

    if (overdueAmount === 0) {
      logger.info(logger.fmt`No significant balance requiring payout in account ${accountId}`);
      return {
        success: true,
        payoutId: 'no-significant-balance',
        connectAccountId: accountId,
        amount: 0,
        currency: currency,
        source: 'stripe_fallback',
      };
    }

    logger.info(
      logger.fmt`Found overdue balance in account ${accountId}: ${overdueAmount / 100} ${currency.toUpperCase()}`,
    );

    // Create payout for the overdue balance
    const payout = await stripe.payouts.create(
      {
        amount: overdueAmount,
        currency: currency,
        metadata: {
          source: 'stripe_fallback',
          reason: 'legal_compliance_verification',
          expertWorkosUserId: expertUser.workosUserId,
          processedAt: new Date().toISOString(),
          automaticComplianceCheck: 'true',
        },
        description: `Legal compliance payout verification`,
      },
      {
        stripeAccount: accountId,
      },
    );

    logger.info(
      logger.fmt`Created compliance payout ${payout.id} for ${overdueAmount / 100} ${currency} to account ${accountId}`,
    );

    // Send notification for Stripe-detected payout
    await sendStripeVerificationNotification(expertUser, payout.id, overdueAmount, currency);

    return {
      success: true,
      payoutId: payout.id,
      connectAccountId: accountId,
      amount: overdueAmount,
      currency: currency,
      source: 'stripe_fallback',
    };
  } catch (error) {
    Sentry.captureException(error);
    logger.error(logger.fmt`Error checking account ${accountId} for overdue balance`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      connectAccountId: accountId,
      error: (error as Error).message,
      retryCount: 0,
      source: 'stripe_fallback',
    };
  }
}

/**
 * Send payout notification with real appointment data
 */
async function sendPayoutNotification(
  transfer: PaymentTransfer,
  expertUser: User,
  payoutId: string,
) {
  try {
    // Get real appointment and client data
    const meetingData = await db
      .select({
        // Note: Use guest name from MeetingsTable, not from UsersTable (guest may not have account)
        clientName: MeetingsTable.guestName,
        serviceName: EventsTable.name,
        appointmentDate: MeetingsTable.startTime,
      })
      .from(PaymentTransfersTable)
      .leftJoin(
        MeetingsTable,
        eq(MeetingsTable.stripePaymentIntentId, PaymentTransfersTable.paymentIntentId),
      )
      .leftJoin(EventsTable, eq(EventsTable.id, PaymentTransfersTable.eventId))
      .where(eq(PaymentTransfersTable.id, transfer.id))
      .limit(1);

    const meeting = meetingData[0];
    const clientName = meeting?.clientName || 'Client';
    const serviceName = meeting?.serviceName || 'Consultation';
    const appointmentDate = meeting?.appointmentDate || transfer.sessionStartTime;
    const appointmentTime = appointmentDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Lisbon',
    });

    await createPayoutCompletedNotification({
      userId: transfer.expertWorkosUserId,
      expertName: expertUser.username || expertUser.email,
      clientName,
      serviceName,
      appointmentDate: appointmentDate.toISOString().split('T')[0],
      appointmentTime,
      amount: transfer.amount,
      currency: transfer.currency,
      payoutId,
      expertEmail: expertUser.email,
      eventId: transfer.eventId,
    });

    logger.info(logger.fmt`Payout notification sent to expert ${transfer.expertWorkosUserId}`);
  } catch (notificationError) {
    Sentry.captureException(notificationError);
    logger.error('Error sending payout notification', {
      error: notificationError instanceof Error ? notificationError.message : String(notificationError),
    });
    // Continue processing even if notification fails
  }
}

/**
 * Send notification for Stripe verification payouts
 */
async function sendStripeVerificationNotification(
  expertUser: ExpertUserForPayout,
  payoutId: string,
  amount: number,
  currency: string,
) {
  try {
    await createPayoutCompletedNotification({
      userId: expertUser.workosUserId,
      // Use username for balance verification notifications (internal process)
      expertName: expertUser.username || expertUser.email,
      clientName: 'Various Clients',
      serviceName: 'Account Balance Verification',
      appointmentDate: new Date().toISOString().split('T')[0],
      appointmentTime: new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Lisbon',
      }),
      amount,
      currency,
      payoutId,
      expertEmail: expertUser.email,
      eventId: 'stripe_verification',
    });

    logger.info(logger.fmt`Stripe verification notification sent to expert ${expertUser.workosUserId}`);
  } catch (notificationError) {
    Sentry.captureException(notificationError);
    logger.error('Error sending Stripe verification notification', {
      error: notificationError instanceof Error ? notificationError.message : String(notificationError),
    });
    // Continue processing even if notification fails
  }
}
