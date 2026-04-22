import { ENV_CONFIG } from '@/config/env';
import { getServerStripe } from '@/lib/integrations/stripe';
import { db } from '@/drizzle/db';
import {
  EventsTable,
  ProfilesTable,
  SlotReservationsTable,
  UsersTable,
} from '@/drizzle/schema';
import {
  sendHeartbeatFailure,
  sendHeartbeatSuccess,
} from '@/lib/integrations/betterstack/heartbeat';
import { triggerWorkflow } from '@/lib/integrations/novu';
import { extractLocaleFromPaymentIntent } from '@/lib/utils/locale';
import * as Sentry from '@sentry/nextjs';
import { format } from 'date-fns';
import { and, eq, gt, isNotNull, isNull, lt } from 'drizzle-orm';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';

const { logger } = Sentry;

export const maxDuration = 60;

/**
 * Rate-limited Stripe API call helper
 * Adds a small delay between Stripe API calls to avoid rate limiting
 */
async function rateLimitedStripeCall<T>(
  apiCall: () => Promise<T>,
  operationName: string,
): Promise<T> {
  try {
    const result = await apiCall();
    // Small delay to avoid hitting Stripe rate limits (100 requests per second)
    await new Promise((resolve) => setTimeout(resolve, 25));
    return result;
  } catch (error) {
    Sentry.captureException(error);
    logger.error(logger.fmt`Stripe API error during ${operationName}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Parse customer name from Stripe PaymentIntent or customer metadata
 */
function parseCustomerName(
  paymentIntent: Stripe.PaymentIntent,
  customerData?: { name?: string | null } | null,
): { firstName: string; lastName: string } {
  // Try to get name from payment intent metadata first
  const meetingData = paymentIntent.metadata?.meeting;
  if (meetingData) {
    try {
      const parsed = JSON.parse(meetingData);
      if (parsed.guestName) {
        const nameParts = parsed.guestName.split(' ');
        return {
          firstName: nameParts[0] || 'Valued',
          lastName: nameParts.slice(1).join(' ') || 'Customer',
        };
      }
    } catch {
      // Continue to next fallback
    }
  }

  // Try direct metadata
  if (paymentIntent.metadata?.customerName) {
    const nameParts = paymentIntent.metadata.customerName.split(' ');
    return {
      firstName: nameParts[0] || 'Valued',
      lastName: nameParts.slice(1).join(' ') || 'Customer',
    };
  }

  // Try customer data
  if (customerData?.name) {
    const nameParts = customerData.name.split(' ');
    return {
      firstName: nameParts[0] || 'Valued',
      lastName: nameParts.slice(1).join(' ') || 'Customer',
    };
  }

  return { firstName: 'Valued', lastName: 'Customer' };
}

/**
 * CRON Job: Send Multibanco Payment Reminders
 *
 * This endpoint sends staged reminders to customers with pending Multibanco payments:
 * - Day 3: Gentle reminder with plenty of time remaining
 * - Day 6: Urgent reminder - final notice before expiration
 *
 * The job tracks which reminders have been sent using dedicated timestamp fields
 * to prevent duplicate emails and ensure proper reminder sequencing.
 *
 * Scheduling recommendation: Run every 6 hours to ensure timely delivery
 */
async function handler(request: NextRequest) {
  logger.info('Starting Multibanco payment reminders job...');

  const stripe = await getServerStripe();

  try {
    const currentTime = new Date();

    // Define reminder stages based on days before expiration
    const reminderStages = [
      {
        type: 'gentle' as const,
        daysBeforeExpiry: 4, // Send on day 3 (4 days before 7-day expiry)
        description: 'Gentle reminder (Day 3)',
        trackingField: 'gentleReminderSentAt' as const,
      },
      {
        type: 'urgent' as const,
        daysBeforeExpiry: 1, // Send on day 6 (1 day before 7-day expiry)
        description: 'Urgent final reminder (Day 6)',
        trackingField: 'urgentReminderSentAt' as const,
      },
    ];

    let totalRemindersSent = 0;
    const reminderResults = [];

    for (const stage of reminderStages) {
      logger.info(`Processing ${stage.description}...`);

      // Calculate the time window for this reminder stage
      const reminderWindowStart = new Date(
        currentTime.getTime() + (stage.daysBeforeExpiry - 0.5) * 24 * 60 * 60 * 1000,
      );
      const reminderWindowEnd = new Date(
        currentTime.getTime() + (stage.daysBeforeExpiry + 0.5) * 24 * 60 * 60 * 1000,
      );

      // Find slot reservations that need reminders
      const reservationsNeedingReminders = await db
        .select({
          reservation: SlotReservationsTable,
          event: {
            id: EventsTable.id,
            name: EventsTable.name,
            durationInMinutes: EventsTable.durationInMinutes,
          },
          expert: {
            username: UsersTable.username,
            email: UsersTable.email,
          },
          profile: {
            firstName: ProfilesTable.firstName,
            lastName: ProfilesTable.lastName,
          },
        })
        .from(SlotReservationsTable)
        .leftJoin(EventsTable, eq(SlotReservationsTable.eventId, EventsTable.id))
        .leftJoin(UsersTable, eq(SlotReservationsTable.workosUserId, UsersTable.workosUserId))
        .leftJoin(ProfilesTable, eq(UsersTable.workosUserId, ProfilesTable.workosUserId))
        .where(
          and(
            // Reservation expires within the reminder window
            gt(SlotReservationsTable.expiresAt, reminderWindowStart),
            lt(SlotReservationsTable.expiresAt, reminderWindowEnd),
            // Reservation is still active (not expired)
            gt(SlotReservationsTable.expiresAt, currentTime),
            // Has a Stripe payment intent (Multibanco payment)
            isNotNull(SlotReservationsTable.stripePaymentIntentId),
            // Hasn't received this type of reminder yet
            stage.type === 'gentle'
              ? isNull(SlotReservationsTable.gentleReminderSentAt)
              : isNull(SlotReservationsTable.urgentReminderSentAt),
          ),
        );

      logger.info(logger.fmt`Found ${reservationsNeedingReminders.length} reservations for ${stage.description}`);

      let stageRemindersSent = 0;

      for (const item of reservationsNeedingReminders) {
        const { reservation, event, expert, profile } = item;

        if (!event || !expert) {
          logger.warn(logger.fmt`Skipping reservation ${reservation.id} - missing event or expert data`);
          continue;
        }

        try {
          // Calculate days remaining
          const daysRemaining = Math.ceil(
            (reservation.expiresAt.getTime() - currentTime.getTime()) / (24 * 60 * 60 * 1000),
          );

          // Additional safety checks to prevent premature reminders
          const hoursSinceCreation =
            (currentTime.getTime() - reservation.createdAt.getTime()) / (1000 * 60 * 60);

          // Don't send gentle reminders too early (wait at least 48 hours after creation)
          if (stage.type === 'gentle' && hoursSinceCreation < 48) {
            logger.info(
              logger.fmt`Skipping gentle reminder for reservation ${reservation.id} - too recent (${hoursSinceCreation.toFixed(1)}h old)`,
            );
            continue;
          }

          // Don't send urgent reminders too early (wait at least 120 hours after creation)
          if (stage.type === 'urgent' && hoursSinceCreation < 120) {
            logger.info(
              logger.fmt`Skipping urgent reminder for reservation ${reservation.id} - not urgent yet (${hoursSinceCreation.toFixed(1)}h old)`,
            );
            continue;
          }

          // Fetch real Multibanco details from Stripe PaymentIntent
          let multibancoDetails = {
            entity: '',
            reference: '',
            amount: '0.00',
            hostedVoucherUrl: '',
          };
          let locale = 'en';
          let customerFirstName = 'Valued';
          let customerLastName = 'Customer';

          if (reservation.stripePaymentIntentId) {
            try {
              const paymentIntent = await rateLimitedStripeCall(
                () =>
                  stripe.paymentIntents.retrieve(reservation.stripePaymentIntentId!, {
                    expand: ['latest_charge.payment_method_details'],
                  }),
                'retrieve payment intent',
              );

              // Extract locale from payment intent metadata
              locale = extractLocaleFromPaymentIntent(paymentIntent);

              // Parse customer name
              const customerName = parseCustomerName(paymentIntent);
              customerFirstName = customerName.firstName;
              customerLastName = customerName.lastName;

              // Get Multibanco voucher details from the latest charge
              const latestCharge = paymentIntent.latest_charge as Stripe.Charge | null;
              const paymentMethodDetails = latestCharge?.payment_method_details;

              if (paymentMethodDetails?.type === 'multibanco' && paymentMethodDetails.multibanco) {
                const multibanco = paymentMethodDetails.multibanco;
                multibancoDetails = {
                  entity: multibanco.entity || '',
                  reference: multibanco.reference || '',
                  amount: (paymentIntent.amount / 100).toFixed(2),
                  hostedVoucherUrl: latestCharge?.receipt_url || '',
                };
              } else {
                // Fallback: Use amount from payment intent if Multibanco details not available
                multibancoDetails.amount = (paymentIntent.amount / 100).toFixed(2);
                logger.warn(
                  logger.fmt`Multibanco details not found for payment intent ${reservation.stripePaymentIntentId}`,
                );
              }
            } catch (stripeError) {
              Sentry.captureException(stripeError);
              logger.error(logger.fmt`Failed to fetch Stripe payment intent for reservation ${reservation.id}`, {
                error: stripeError instanceof Error ? stripeError.message : String(stripeError),
              });
              // Continue with placeholder values
            }
          }

          // Format appointment details
          // Use profile name if available, otherwise fallback to username or 'Expert'
          const expertName = profile
            ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
            : expert.username || 'Expert';
          const appointmentDate = format(reservation.startTime, 'EEEE, MMMM d, yyyy');
          const appointmentTime = format(reservation.startTime, 'h:mm a');
          const voucherExpiresFormatted = format(reservation.expiresAt, 'PPP p');
          const customerFullName = `${customerFirstName} ${customerLastName}`.trim();

          // Trigger Novu workflow for payment reminder
          const workflowResult = await triggerWorkflow({
            workflowId: 'multibanco-payment-reminder',
            to: {
              subscriberId: reservation.guestEmail,
              email: reservation.guestEmail,
              firstName: customerFirstName,
              lastName: customerLastName,
              data: {
                locale,
              },
            },
            payload: {
              customerName: customerFullName,
              expertName,
              serviceName: event.name,
              appointmentDate,
              appointmentTime,
              timezone: 'Europe/Lisbon', // Default for Multibanco
              duration: event.durationInMinutes,
              multibancoEntity: multibancoDetails.entity,
              multibancoReference: multibancoDetails.reference,
              multibancoAmount: multibancoDetails.amount,
              voucherExpiresAt: voucherExpiresFormatted,
              hostedVoucherUrl: multibancoDetails.hostedVoucherUrl,
              reminderType: stage.type,
              daysRemaining,
              locale,
            },
          });

          if (workflowResult) {
            logger.info(
              logger.fmt`${stage.description} sent to ${reservation.guestEmail} for reservation ${reservation.id}`,
            );

            // Mark reminder as sent to prevent duplicates
            await db
              .update(SlotReservationsTable)
              .set({
                [stage.trackingField]: currentTime,
                updatedAt: currentTime,
              })
              .where(eq(SlotReservationsTable.id, reservation.id));

            stageRemindersSent++;
          } else {
            logger.error(
              logger.fmt`Failed to trigger workflow for ${stage.description} to ${reservation.guestEmail}`,
            );
          }
        } catch (reminderError) {
          logger.error(`Error sending reminder for reservation ${reservation.id}`, {
            error: reminderError instanceof Error ? reminderError.message : String(reminderError),
          });
        }
      }

      reminderResults.push({
        stage: stage.description,
        found: reservationsNeedingReminders.length,
        sent: stageRemindersSent,
      });

      totalRemindersSent += stageRemindersSent;
    }

    logger.info('Payment reminders job completed', {
      totalRemindersSent,
      stages: reminderResults,
      timestamp: currentTime.toISOString(),
    });

    // Send success heartbeat to BetterStack
    await sendHeartbeatSuccess({
      url: ENV_CONFIG.BETTERSTACK_PAYMENT_REMINDERS_HEARTBEAT,
      jobName: 'Multibanco Payment Reminders',
    });

    return NextResponse.json({
      success: true,
      totalRemindersSent,
      stages: reminderResults,
      timestamp: currentTime.toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error during payment reminders job', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Send failure heartbeat to BetterStack
    await sendHeartbeatFailure(
      {
        url: ENV_CONFIG.BETTERSTACK_PAYMENT_REMINDERS_HEARTBEAT,
        jobName: 'Multibanco Payment Reminders',
      },
      error,
    );

    return NextResponse.json(
      { error: 'Failed to process payment reminders', details: String(error) },
      { status: 500 },
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
