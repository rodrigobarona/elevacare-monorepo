import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import {
  BlockedDatesTable,
  EventsTable,
  MeetingsTable,
  PaymentTransfersTable,
  ProfilesTable,
  SchedulingSettingsTable,
  SlotReservationsTable,
  UsersTable,
} from '@/drizzle/schema';
import MultibancoBookingPendingTemplate from '@/emails/payments/multibanco-booking-pending';
import RefundNotificationTemplate from '@/emails/payments/refund-notification';
import {
  NOTIFICATION_TYPE_ACCOUNT_UPDATE,
  NOTIFICATION_TYPE_SECURITY_ALERT,
} from '@/lib/constants/notifications';
import {
  PAYMENT_TRANSFER_STATUS_DISPUTED,
  PAYMENT_TRANSFER_STATUS_FAILED,
  PAYMENT_TRANSFER_STATUS_PENDING,
  PAYMENT_TRANSFER_STATUS_READY,
  PAYMENT_TRANSFER_STATUS_REFUNDED,
} from '@/lib/constants/payment-transfers';
import { triggerWorkflow } from '@/lib/integrations/novu';
import { generateAppointmentEmail, sendEmail } from '@/lib/integrations/novu/email';
import { extractLocaleFromPaymentIntent } from '@/lib/utils/locale';
import { getServerStripe, withRetry } from '@/lib/integrations/stripe';
import { createUserNotification } from '@/lib/notifications/core';
import { render } from '@react-email/components';
import { format, toZonedTime } from 'date-fns-tz';
import { and, eq } from 'drizzle-orm';
import Stripe from 'stripe';

const { logger } = Sentry;

// Helper function to parse metadata safely
function parseMetadata<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.error('Failed to parse metadata', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

/**
 * Notify expert about successful payment
 */
async function notifyExpertOfPaymentSuccess(transfer: { expertWorkosUserId: string }) {
  await createUserNotification({
    userId: transfer.expertWorkosUserId,
    type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
    data: {
      userName: 'Expert',
      title: 'Payment Received',
      message: 'A payment for your session has been successfully processed.',
      actionUrl: '/account/payments',
    },
  });
}

/**
 * Notify expert about failed payment
 */
async function notifyExpertOfPaymentFailure(
  transfer: { expertWorkosUserId: string },
  paymentIntentId: string,
  lastPaymentError: string,
  meetingDetails?: {
    guestName: string | null;
    eventId: string;
    startTime: Date;
  },
) {
  let message = `A payment for one of your sessions (PI: ${paymentIntentId}) has failed. Reason: ${lastPaymentError}. The client may need to update their payment method or rebook.`;

  if (meetingDetails) {
    message = `Payment for your session with ${meetingDetails.guestName || 'guest'} for event ID ${meetingDetails.eventId} scheduled at ${meetingDetails.startTime.toISOString()} has failed. Reason: ${lastPaymentError}. The meeting has been canceled and the guest notified. They may attempt to rebook.`;
  }

  await createUserNotification({
    userId: transfer.expertWorkosUserId,
    type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
    data: {
      userName: 'Expert',
      title: 'Important: Session Payment Failed & Canceled',
      message,
      actionUrl: '/account/payments',
    },
  });
}

/**
 * Notify expert about payment refund
 */
async function notifyExpertOfPaymentRefund(transfer: { expertWorkosUserId: string }) {
  await createUserNotification({
    userId: transfer.expertWorkosUserId,
    type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
    data: {
      userName: 'Expert',
      title: 'Payment Refunded',
      message: 'A payment has been refunded for one of your sessions.',
      actionUrl: '/account/payments',
    },
  });
}

/**
 * Notify expert about payment dispute
 */
async function notifyExpertOfPaymentDispute(transfer: { expertWorkosUserId: string }) {
  await createUserNotification({
    userId: transfer.expertWorkosUserId,
    type: NOTIFICATION_TYPE_SECURITY_ALERT,
    data: {
      userName: 'Expert',
      title: 'Payment Dispute Opened',
      message:
        'A payment dispute has been opened for one of your sessions. We will contact you with more information.',
      actionUrl: '/account/payments',
    },
  });
}

/**
 * Helper to check if two time ranges overlap
 */
function hasTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Releases a calendar creation claim to allow webhook retries.
 *
 * Part of the calendar creation idempotency system. When a meeting is claimed
 * for calendar creation (calendarCreationClaimed = true), but the creation fails,
 * this function resets the claim so subsequent webhook retries can attempt again.
 *
 * @param meetingId - The UUID of the meeting to release the claim for
 *
 * @remarks
 * This function is intentionally fire-and-forget with error logging.
 * Even if claim release fails, it won't block the webhook response.
 *
 * @see {@link handlePaymentSucceeded} - Uses this for idempotent calendar creation
 * @see {@link https://eleva.care/_docs/02-core-systems/payments/11-calendar-creation-idempotency.md}
 *
 * @example
 * ```typescript
 * try {
 *   await createCalendarEvent(meeting);
 * } catch (error) {
 *   await releaseClaim(meeting.id); // Allow retry
 *   throw error;
 * }
 * ```
 */
async function releaseClaim(meetingId: string): Promise<void> {
  try {
    await db
      .update(MeetingsTable)
      .set({
        calendarCreationClaimed: false,
        updatedAt: new Date(),
      })
      .where(eq(MeetingsTable.id, meetingId));
    logger.info(`Released calendar creation claim for meeting ${meetingId}`);
  } catch (releaseError) {
    logger.error(`Failed to release claim for meeting ${meetingId}`, {
      error: releaseError instanceof Error ? releaseError.message : String(releaseError),
    });
  }
}

/**
 * Enhanced collision detection that considers blocked dates, booking conflicts, and minimum notice periods
 *
 * Priority order (for detection logic):
 * 1. Blocked dates (expert blocked after booking) → 100% refund
 * 2. Time range overlaps (slot already booked) → 100% refund
 * 3. Minimum notice violations (too close to start time) → 100% refund
 *
 * ALL conflicts result in 100% refund under v3.0 customer-first policy
 *
 * Timezone Handling (Critical):
 * - Each blocked date has its own timezone field (BlockedDatesTable.timezone)
 * - We format the appointment time in EACH blocked date's specific timezone
 * - This correctly handles cases where:
 *   • Expert changes their schedule timezone after blocking dates
 *   • Blocked dates were created with different timezones (e.g., expert traveling)
 * - Example: Blocked date '2025-02-15' in 'America/New_York' will match an appointment
 *   at 2025-02-16 04:00 UTC (which is 2025-02-15 23:00 EST)
 *
 * @param expertId - Expert's WorkOS user ID
 * @param startTime - Appointment start time (UTC)
 * @param eventId - Event ID to get duration information
 * @returns Object with conflict info and reason
 */
async function checkAppointmentConflict(
  expertId: string,
  startTime: Date,
  eventId: string,
): Promise<{
  hasConflict: boolean;
  reason?: string;
  minimumNoticeHours?: number;
  blockedDateReason?: string;
}> {
  return Sentry.startSpan(
    {
      name: 'stripe.conflict.check',
      op: 'db.query',
      attributes: {
        'conflict.expert_id': expertId,
        'conflict.event_id': eventId,
        'conflict.start_time': startTime.toISOString(),
      },
    },
    async (span) => {
      try {
        Sentry.logger.debug('Enhanced collision check', {
          expertId,
          startTime: startTime.toISOString(),
          eventId,
        });

        // Get the event details to calculate the appointment end time
        const event = await db.query.EventsTable.findFirst({
          where: eq(EventsTable.id, eventId),
          columns: { durationInMinutes: true },
        });

        if (!event) {
          logger.error(`Event not found: ${eventId}`);
          return { hasConflict: true, reason: 'event_not_found' };
        }

        // Calculate the end time of the new appointment
        const endTime = new Date(startTime.getTime() + event.durationInMinutes * 60 * 1000);

        logger.info(
          `New appointment: ${startTime.toISOString()} - ${endTime.toISOString()} (${event.durationInMinutes} min)`,
        );

        // 🆕 PRIORITY 1: Check for BLOCKED DATES (Expert's responsibility - 100% refund)
        // Get all blocked dates for the expert (with their individual timezones)
        // Note: Each blocked date has its own timezone field that must be used for accurate detection
        const blockedDates = await db.query.BlockedDatesTable.findMany({
          where: eq(BlockedDatesTable.workosUserId, expertId),
        });

        logger.info(`Checking ${blockedDates.length} blocked dates for expert ${expertId}`);

        // Check if appointment falls on any blocked date in that date's specific timezone
        for (const blockedDate of blockedDates) {
          // Format both the appointment start and end times in the blocked date's timezone
          const appointmentDateInBlockedTz = format(startTime, 'yyyy-MM-dd', {
            timeZone: blockedDate.timezone,
          });

          const appointmentEndDateInBlockedTz = format(endTime, 'yyyy-MM-dd', {
            timeZone: blockedDate.timezone,
          });

          // Check if the appointment conflicts with the blocked date:
          // 1. Start date matches blocked date, OR
          // 2. End date matches blocked date, OR
          // 3. Appointment spans the blocked date (start and end dates differ, and either matches)
          const startDateMatches = appointmentDateInBlockedTz === blockedDate.date;
          const endDateMatches = appointmentEndDateInBlockedTz === blockedDate.date;
          const spansBlockedDate =
            appointmentDateInBlockedTz !== appointmentEndDateInBlockedTz &&
            (startDateMatches || endDateMatches);

          if (startDateMatches || endDateMatches || spansBlockedDate) {
            logger.info('Blocked date conflict detected', {
              appointmentTimeUtc: `${startTime.toISOString()} - ${endTime.toISOString()}`,
              appointmentStartDateInBlockedTz: appointmentDateInBlockedTz,
              appointmentEndDateInBlockedTz: appointmentEndDateInBlockedTz,
              blockedDate: blockedDate.date,
              blockedDateTimezone: blockedDate.timezone,
              expertId,
              reason: blockedDate.reason || 'Not specified',
              blockedId: blockedDate.id,
            });
            return {
              hasConflict: true,
              reason: 'expert_blocked_date',
              blockedDateReason: blockedDate.reason || undefined,
            };
          }
        }

        logger.info(`No blocked date conflicts found (checked ${blockedDates.length} blocked dates)`);

        // PRIORITY 2: Check for existing confirmed meetings with TIME RANGE OVERLAP
        const conflictingMeetings = await db.query.MeetingsTable.findMany({
          where: and(
            eq(MeetingsTable.workosUserId, expertId),
            eq(MeetingsTable.stripePaymentStatus, 'succeeded'),
          ),
          with: {
            event: {
              columns: { durationInMinutes: true },
            },
          },
        });

        for (const existingMeeting of conflictingMeetings) {
          const existingEndTime = new Date(
            existingMeeting.startTime.getTime() +
              existingMeeting.event.durationInMinutes * 60 * 1000,
          );

          // Use helper for overlap check
          if (hasTimeOverlap(startTime, endTime, existingMeeting.startTime, existingEndTime)) {
            logger.info('Time range overlap detected', {
              existingStart: existingMeeting.startTime.toISOString(),
              existingEnd: existingEndTime.toISOString(),
              existingDuration: existingMeeting.event.durationInMinutes,
              newStart: startTime.toISOString(),
              newEnd: endTime.toISOString(),
              newDuration: event.durationInMinutes,
              meetingId: existingMeeting.id,
            });
            return { hasConflict: true, reason: 'time_range_overlap' };
          }
        }

        logger.info('No time range conflicts found');

        // PRIORITY 3: Check minimum notice period requirements from expert's settings
        const expertSchedulingSettings = await db.query.SchedulingSettingsTable.findFirst({
          where: eq(SchedulingSettingsTable.workosUserId, expertId),
        });

        // Get the minimum notice in minutes from expert's settings, default to 1440 (24 hours)
        const minimumNoticeMinutes = expertSchedulingSettings?.minimumNotice || 1440;
        const currentTime = new Date();
        const millisecondsUntilAppointment = startTime.getTime() - currentTime.getTime();
        const minutesUntilAppointment = millisecondsUntilAppointment / (1000 * 60);

        logger.info(
          `Expert ${expertId} minimum notice: ${minimumNoticeMinutes} minutes, appointment in ${minutesUntilAppointment.toFixed(1)} minutes`,
        );

        if (minutesUntilAppointment < minimumNoticeMinutes) {
          const minimumNoticeHours = Math.ceil(minimumNoticeMinutes / 60);
          const availableHours = Math.floor(minutesUntilAppointment / 60);

          logger.info(
            `Minimum notice violation: appointment at ${startTime.toISOString()} requires ${minimumNoticeHours}h notice, but only ${availableHours}h available`,
          );

          return {
            hasConflict: true,
            reason: 'minimum_notice_violation',
            minimumNoticeHours,
          };
        }

        span.setAttribute('conflict.has_conflict', false);
        Sentry.logger.debug('No conflicts found', { expertId, startTime: startTime.toISOString() });
        return { hasConflict: false };
      } catch (error) {
        // Enhanced error monitoring with structured context for operational visibility
        span.setAttribute('conflict.error', true);
        Sentry.logger.error('CRITICAL: Conflict check failed', {
          expertId,
          appointmentTime: startTime.toISOString(),
          eventId,
          error: error instanceof Error ? error.message : String(error),
          note: 'Defaulting to no conflict to avoid blocking legitimate payment.',
        });

        // In case of error, assume no conflict to avoid blocking legitimate payments
        // Business decision: Prefer false negatives over false positives to maintain user experience
        return { hasConflict: false };
      }
    },
  );
}

/**
 * Process full refund for appointment conflicts
 *
 * CUSTOMER-FIRST POLICY (v3.0):
 * - 100% refund for ALL conflicts (blocked dates, time overlaps, minimum notice)
 * - No processing fees charged to customers
 * - Eleva Care absorbs payment processing costs
 *
 * @param paymentIntent - Stripe Payment Intent object
 * @param reason - Human-readable conflict reason
 * @param conflictType - Type of conflict detected (for logging and analytics)
 * @returns Stripe Refund object or null if failed
 */
async function processPartialRefund(
  paymentIntent: Stripe.PaymentIntent,
  reason: string,
  conflictType:
    | 'expert_blocked_date'
    | 'time_range_overlap'
    | 'minimum_notice_violation'
    | 'unknown_conflict',
): Promise<Stripe.Refund | null> {
  return Sentry.startSpan(
    {
      name: 'stripe.refund.conflict',
      op: 'stripe.api',
      attributes: {
        'stripe.payment_intent_id': paymentIntent.id,
        'stripe.refund.conflict_type': conflictType,
        'stripe.refund.original_amount': paymentIntent.amount,
      },
    },
    async (span) => {
      try {
        const stripe = await getServerStripe();
        const originalAmount = paymentIntent.amount;

        // 🆕 CUSTOMER-FIRST POLICY (v3.0): Always 100% refund for any conflict
        // No processing fees charged - Eleva Care absorbs the cost
        const refundAmount = originalAmount; // Always 100% refund
        const processingFee = 0; // No fee charged
        const refundPercentage = '100';

        Sentry.logger.info('Processing full refund for conflict', {
          paymentIntentId: paymentIntent.id,
          conflictType,
          originalAmount: (originalAmount / 100).toFixed(2),
          refundAmount: (refundAmount / 100).toFixed(2),
          reason,
        });

        const refund = await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            reason: reason,
            conflict_type: conflictType,
            original_amount: originalAmount.toString(),
            processing_fee: processingFee.toString(),
            refund_percentage: refundPercentage,
            policy_version: '3.0', // Customer-first: Always 100% refund
          },
        });

        span.setAttribute('stripe.refund_id', refund.id);
        span.setAttribute('stripe.refund.amount', refund.amount);
        span.setAttribute('stripe.refund.status', refund.status || 'unknown');

        Sentry.logger.info('Full refund processed successfully', {
          refundId: refund.id,
          amount: (refund.amount / 100).toFixed(2),
          status: refund.status,
          paymentIntentId: paymentIntent.id,
        });

        return refund;
      } catch (error) {
        Sentry.logger.error('Error processing refund', {
          paymentIntentId: paymentIntent.id,
          conflictType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    },
  );
}

/**
 * Send conflict notification using branded refund email template with multilingual support
 *
 * @param guestEmail - Recipient email address
 * @param guestName - Recipient name for personalization
 * @param expertName - Name of the expert for the appointment
 * @param startTime - Appointment start time (UTC)
 * @param refundAmount - Refund amount in minor units (cents)
 * @param originalAmount - Original payment amount in minor units (cents)
 * @param locale - User's locale for email content
 * @param conflictReason - Reason code for the conflict
 * @param minimumNoticeHours - Optional minimum notice hours (for logging)
 * @param paymentIntentId - Stripe payment intent ID for reference
 * @param timezone - IANA timezone for formatting dates (e.g., 'Europe/Lisbon')
 * @param currency - Currency code (e.g., 'eur', 'usd') - defaults to 'eur'
 */
async function notifyAppointmentConflict(
  guestEmail: string,
  guestName: string,
  expertName: string,
  startTime: Date,
  refundAmount: number,
  originalAmount: number,
  locale: string,
  conflictReason: string,
  minimumNoticeHours?: number,
  paymentIntentId?: string,
  timezone: string = 'Europe/Lisbon',
  currency: string = 'eur',
) {
  try {
    logger.info(
      `Sending branded conflict notification to ${guestEmail} in locale ${locale} for reason: ${conflictReason}`,
    );

    // Format amounts for display
    const refundAmountFormatted = (refundAmount / 100).toFixed(2);
    const originalAmountFormatted = (originalAmount / 100).toFixed(2);

    // Format date and time in the user's timezone
    const zonedTime = toZonedTime(startTime, timezone);
    const appointmentDate = format(zonedTime, 'PPPP', { timeZone: timezone });
    const appointmentTime = format(zonedTime, 'p', { timeZone: timezone });

    // Determine SupportedLocale type
    const localeLower = (locale || 'en').toLowerCase();
    const supportedLocale = localeLower.startsWith('pt')
      ? 'pt'
      : localeLower.startsWith('es')
        ? 'es'
        : 'en';

    // Normalize currency to uppercase for display
    const currencyDisplay = (currency || 'EUR').toUpperCase();

    // Render branded refund notification email
    const emailHtml = await render(
      RefundNotificationTemplate({
        customerName: guestName,
        expertName,
        serviceName: 'Appointment', // Generic service name for conflict notifications
        appointmentDate,
        appointmentTime,
        originalAmount: originalAmountFormatted,
        refundAmount: refundAmountFormatted,
        currency: currencyDisplay,
        refundReason: conflictReason,
        transactionId: paymentIntentId,
        locale: supportedLocale,
      }),
    );

    // Determine subject based on locale
    const subjects = {
      en: 'Appointment Conflict - Full Refund Processed',
      pt: 'Conflito de Agendamento - Reembolso Total Processado',
      es: 'Conflicto de Cita - Reembolso Total Procesado',
    };

    await sendEmail({
      to: guestEmail,
      subject: subjects[supportedLocale] || subjects.en,
      html: emailHtml,
    });

    logger.info(
      `Branded conflict notification sent to ${guestEmail} (reason: ${conflictReason}${minimumNoticeHours ? `, minimum notice: ${minimumNoticeHours}h` : ''})`,
    );
  } catch (error) {
    logger.error('Error sending conflict notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  return Sentry.startSpan(
    {
      name: 'stripe.payment.succeeded',
      op: 'webhook.handler',
      attributes: {
        'stripe.payment_intent_id': paymentIntent.id,
        'stripe.amount': paymentIntent.amount,
        'stripe.currency': paymentIntent.currency,
        'stripe.status': paymentIntent.status,
        'stripe.payment_method_types': paymentIntent.payment_method_types?.join(',') || 'unknown',
      },
    },
    async (span) => {
      Sentry.logger.info('Payment succeeded', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });

      try {
        // Parse meeting metadata to check if this might be a late Multibanco payment
        const meetingData = parseMetadata(paymentIntent.metadata?.meeting, {
          id: '',
          expert: '',
          guest: '',
          guestName: '',
          start: '',
          dur: 0,
          notes: '',
        });

        // Check if this is a Multibanco payment and if it's potentially late
        const isMultibancoPayment = paymentIntent.payment_method_types?.includes('multibanco');

        // 🆕 CRITICAL FIX: For Multibanco payments, recalculate transfer schedule
        // based on ACTUAL payment time, not the initial booking time
        let recalculatedTransferTime: Date | null = null;

        if (isMultibancoPayment && meetingData.expert && meetingData.start) {
          // 🛡️ VALIDATION: Ensure meetingData.dur is a finite number before date calculations
          // This prevents NaN from breaking date math and transfer scheduling
          if (!Number.isFinite(meetingData.dur) || meetingData.dur <= 0) {
            logger.warn(
              'Multibanco transfer recalculation aborted: Invalid duration in payment metadata',
              {
                paymentIntentId: paymentIntent.id,
                meetingId: meetingData.id || 'unknown',
                expertId: meetingData.expert,
                appointmentStart: meetingData.start,
                invalidDuration: meetingData.dur,
                durationType: typeof meetingData.dur,
                reason: !Number.isFinite(meetingData.dur)
                  ? 'Duration is not a finite number (undefined, null, NaN, or Infinity)'
                  : 'Duration is zero or negative',
                impact:
                  'Skipping transfer time recalculation AND conflict checks - will use original scheduled time from metadata',
                action:
                  'Verify payment intent metadata structure and ensure "dur" field contains valid positive number',
              },
            );
            // Abort recalculation - leave recalculatedTransferTime as null
            // The code will fall back to using originalScheduledTime from transferData.scheduled
            // Skip conflict checks as well since we can't reliably calculate appointment end time
          } else {
            const appointmentStart = new Date(meetingData.start);
            const appointmentEnd = new Date(
              appointmentStart.getTime() + meetingData.dur * 60 * 1000,
            );
            const paymentTime = new Date(); // When payment actually succeeded

            // Calculate the earliest transfer date based on BOTH requirements:
            // 1. At least 24h after appointment ends (customer complaint window)
            // 2. At least 7 days after payment succeeds (regulatory compliance)
            const minimumTransferDate = new Date(appointmentEnd.getTime() + 24 * 60 * 60 * 1000);
            const paymentAgeBasedTransferDate = new Date(
              paymentTime.getTime() + 7 * 24 * 60 * 60 * 1000,
            );

            // Use the LATER of the two dates
            recalculatedTransferTime = new Date(
              Math.max(minimumTransferDate.getTime(), paymentAgeBasedTransferDate.getTime()),
            );
            recalculatedTransferTime.setHours(4, 0, 0, 0);

            logger.info('Recalculated Multibanco transfer schedule:', {
              paymentTime: paymentTime.toISOString(),
              appointmentStart: appointmentStart.toISOString(),
              appointmentEnd: appointmentEnd.toISOString(),
              minimumTransferDate: minimumTransferDate.toISOString(),
              paymentAgeBasedTransferDate: paymentAgeBasedTransferDate.toISOString(),
              recalculatedTransferTime: recalculatedTransferTime.toISOString(),
              hoursAfterAppointmentEnd: Math.floor(
                (recalculatedTransferTime.getTime() - appointmentEnd.getTime()) / (60 * 60 * 1000),
              ),
              daysFromPayment: Math.floor(
                (recalculatedTransferTime.getTime() - paymentTime.getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            });

            // Check for conflicts (blocked dates, overlaps, minimum notice)
            // Only perform conflict check if we have valid duration data
            const conflictResult = await checkAppointmentConflict(
              meetingData.expert,
              appointmentStart,
              meetingData.id,
            );

            if (conflictResult.hasConflict) {
              logger.info(
                `Late Multibanco payment conflict detected for PI ${paymentIntent.id}`,
              );

              // Map conflict reason to allowed conflictType values
              let conflictType:
                | 'expert_blocked_date'
                | 'time_range_overlap'
                | 'minimum_notice_violation'
                | 'unknown_conflict';

              if (conflictResult.reason === 'expert_blocked_date') {
                conflictType = 'expert_blocked_date';
              } else if (conflictResult.reason === 'time_range_overlap') {
                conflictType = 'time_range_overlap';
              } else if (conflictResult.reason === 'minimum_notice_violation') {
                conflictType = 'minimum_notice_violation';
              } else {
                conflictType = 'unknown_conflict';
              }

              const refund = await processPartialRefund(
                paymentIntent,
                conflictResult.reason === 'expert_blocked_date'
                  ? 'Expert blocked this date after your booking was made'
                  : 'Appointment time slot no longer available due to late payment',
                conflictType,
              );

              if (refund) {
                // Get expert's PROFESSIONAL name from ProfilesTable for patient-facing communication
                const expertProfile = await db.query.ProfilesTable.findFirst({
                  where: eq(ProfilesTable.workosUserId, meetingData.expert),
                  columns: { firstName: true, lastName: true },
                });

                const expertName = expertProfile
                  ? `${expertProfile.firstName} ${expertProfile.lastName}`.trim()
                  : 'Expert';

                // Get meeting timezone for proper date formatting in notification
                const meetingRecord = meetingData.id
                  ? await db.query.MeetingsTable.findFirst({
                      where: eq(MeetingsTable.id, meetingData.id),
                      columns: { timezone: true },
                    })
                  : null;
                const meetingTimezone = meetingRecord?.timezone || 'Europe/Lisbon';

                // Notify all parties about the conflict
                await notifyAppointmentConflict(
                  meetingData.guest,
                  meetingData.guestName || 'Guest',
                  expertName,
                  appointmentStart,
                  refund.amount,
                  paymentIntent.amount,
                  extractLocaleFromPaymentIntent(paymentIntent),
                  conflictResult.reason || 'unknown_conflict',
                  conflictResult.minimumNoticeHours,
                  paymentIntent.id,
                  meetingTimezone,
                  paymentIntent.currency,
                );

                logger.info(
                  `Conflict handled: 100% refund processed for PI ${paymentIntent.id} (v3.0 Customer-First policy)`,
                );

                // Mark the meeting as refunded and return early
                await db
                  .update(MeetingsTable)
                  .set({
                    stripePaymentStatus: 'refunded',
                    updatedAt: new Date(),
                  })
                  .where(eq(MeetingsTable.stripePaymentIntentId, paymentIntent.id));

                return; // Exit early - don't create calendar event or proceed with normal flow
              }
            } else {
              logger.info(`Multibanco payment ${paymentIntent.id} processed without conflicts`);
            }
          } // End of valid duration check
        } // End of Multibanco payment check

        // If no conflict or not a Multibanco payment, proceed with normal flow
        // Update Meeting status
        const updatedMeeting = await db
          .update(MeetingsTable)
          .set({
            stripePaymentStatus: 'succeeded',
            updatedAt: new Date(),
          })
          .where(eq(MeetingsTable.stripePaymentIntentId, paymentIntent.id))
          .returning();

        if (updatedMeeting.length === 0) {
          logger.warn(
            `No meeting found with paymentIntentId ${paymentIntent.id} to update status to succeeded.`,
          );
          // It's possible the meeting is created via a different flow or checkout session ID only
          // If checkout_session_id is available in paymentIntent metadata, we could try that as a fallback.
          // For now, we proceed to update the transfer record if it exists.
        } else {
          const meeting = updatedMeeting[0];
          logger.info(
            `Meeting ${meeting.id} status updated to succeeded for paymentIntentId ${paymentIntent.id}`,
          );

          // If meeting doesn't have a meeting URL yet (was created with pending payment), create calendar event now
          // Use idempotency via calendarCreationClaimed to prevent duplicate calendar events on webhook retries
          if (!meeting.meetingUrl) {
            // Check if another process has already claimed this meeting for calendar creation
            // This prevents race conditions when multiple webhook retries occur simultaneously
            const claimResult = await db
              .update(MeetingsTable)
              .set({
                calendarCreationClaimed: true,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(MeetingsTable.id, meeting.id),
                  eq(MeetingsTable.calendarCreationClaimed, false),
                ),
              )
              .returning({ id: MeetingsTable.id });

            if (claimResult.length === 0) {
              logger.info(
                `Calendar creation already claimed for meeting ${meeting.id}, skipping (idempotency)`,
              );
            } else {
              try {
                logger.info(`Creating deferred calendar event for meeting ${meeting.id}...`);

                // Get the event details for calendar creation
                const event = await db.query.EventsTable.findFirst({
                  where: eq(EventsTable.id, meeting.eventId),
                });

                if (event) {
                  // Dynamic import to avoid circular dependency with calendar service
                  // The calendar service depends on meeting types which depend on payment types
                  const { createCalendarEvent } = await import('@/server/googleCalendar');

                  logger.info('Calling createCalendarEvent for deferred booking:', {
                    meetingId: meeting.id,
                    workosUserId: meeting.workosUserId,
                    guestEmail: meeting.guestEmail,
                    timezone: meeting.timezone,
                  });

                  // Timeout helper to prevent calendar creation from hanging
                  const CALENDAR_CREATION_TIMEOUT_MS = 25000; // 25 seconds
                  let timerId: ReturnType<typeof setTimeout> | undefined;
                  const timeoutPromise = new Promise<never>((_, reject) => {
                    timerId = setTimeout(() => {
                      reject(new Error('Calendar creation timeout after 25 seconds'));
                    }, CALENDAR_CREATION_TIMEOUT_MS);
                  });

                  try {
                    // Race between calendar creation and timeout
                    const calendarEvent = await Promise.race([
                      createCalendarEvent({
                        workosUserId: meeting.workosUserId,
                        guestName: meeting.guestName,
                        guestEmail: meeting.guestEmail,
                        startTime: meeting.startTime,
                        guestNotes: meeting.guestNotes || undefined,
                        durationInMinutes: event.durationInMinutes,
                        eventName: event.name,
                        timezone: meeting.timezone,
                        locale: extractLocaleFromPaymentIntent(paymentIntent),
                      }),
                      timeoutPromise,
                    ]);

                    const meetingUrl = calendarEvent.conferenceData?.entryPoints?.[0]?.uri ?? null;

                    // Update meeting with the new URL
                    if (meetingUrl) {
                      await db
                        .update(MeetingsTable)
                        .set({
                          meetingUrl: meetingUrl,
                          updatedAt: new Date(),
                        })
                        .where(eq(MeetingsTable.id, meeting.id));

                      logger.info(
                        `Calendar event created and meeting URL updated for meeting ${meeting.id}`,
                      );
                    } else {
                      logger.warn(
                        `Calendar event created but no meeting URL extracted for meeting ${meeting.id}`,
                      );
                    }

                    // Clean up slot reservation if it exists
                    try {
                      await db
                        .delete(SlotReservationsTable)
                        .where(eq(SlotReservationsTable.stripePaymentIntentId, paymentIntent.id));
                      logger.info(
                        `Cleaned up slot reservation for payment intent ${paymentIntent.id}`,
                      );
                    } catch (cleanupError) {
                      logger.error('Failed to clean up slot reservation', {
                        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                      });
                      // Continue execution - this is not critical
                    }
                  } finally {
                    // Always clean up the timeout to prevent memory leaks
                    if (timerId) clearTimeout(timerId);
                  }
                } else {
                  logger.error(
                    `Event ${meeting.eventId} not found for deferred calendar creation`,
                  );
                  // Release the claim so retries can attempt again
                  await releaseClaim(meeting.id);
                }
              } catch (calendarError) {
                logger.error(
                  `Failed to create deferred calendar event for meeting ${meeting.id}:`,
                  {
                    error: calendarError instanceof Error ? calendarError.message : calendarError,
                    stack: calendarError instanceof Error ? calendarError.stack : undefined,
                    meetingId: meeting.id,
                    paymentIntentId: paymentIntent.id,
                  },
                );
                // Release the claim so webhook retries can attempt again
                await releaseClaim(meeting.id);
                // Don't fail the entire webhook for calendar errors - payment succeeded
              }
            }
          } else {
            logger.info(
              `Meeting ${meeting.id} already has a meeting URL: ${meeting.meetingUrl}`,
            );
          }

          // Find the payment transfer record
          const transfer = await db.query.PaymentTransfersTable.findFirst({
            where: eq(PaymentTransfersTable.paymentIntentId, paymentIntent.id),
          });

          // Handle transfer status update
          if (!transfer) {
            // If no transfer record exists, create one from the payment intent metadata
            const transferData = parseMetadata(paymentIntent.metadata?.transfer, {
              status: PAYMENT_TRANSFER_STATUS_PENDING,
              account: '',
              country: '',
              delay: { aging: 0, remaining: 0, required: 0 },
              scheduled: '',
            });

            const paymentData = parseMetadata(paymentIntent.metadata?.payment, {
              amount: '0',
              fee: '0',
              expert: '0',
            });

            // Validate critical fields before creating transfer record
            if (transferData && paymentData && meeting) {
              // Validate transfer data
              if (!transferData.account) {
                logger.error(
                  `Missing expert connect account ID in transfer metadata for PI ${paymentIntent.id}`,
                );
                return;
              }

              if (!transferData.scheduled) {
                logger.error(
                  `Missing scheduled transfer time in transfer metadata for PI ${paymentIntent.id}`,
                );
                return;
              }

              // Validate payment amounts
              const amount = Number.parseInt(paymentData.expert, 10);
              const fee = Number.parseInt(paymentData.fee, 10);

              if (Number.isNaN(amount) || amount <= 0) {
                logger.error(
                  `Invalid expert payment amount in metadata for PI ${paymentIntent.id}: ${paymentData.expert}`,
                );
                return;
              }

              if (Number.isNaN(fee) || fee < 0) {
                logger.error(
                  `Invalid platform fee in metadata for PI ${paymentIntent.id}: ${paymentData.fee}`,
                );
                return;
              }

              // Validate scheduled transfer time
              // 🆕 CRITICAL FIX: For Multibanco, use recalculated time if available
              const originalScheduledTime = new Date(transferData.scheduled);
              const scheduledTime = recalculatedTransferTime || originalScheduledTime;

              if (Number.isNaN(scheduledTime.getTime())) {
                logger.error(
                  `Invalid scheduled transfer time in metadata for PI ${paymentIntent.id}: ${transferData.scheduled}`,
                );
                return;
              }

              if (recalculatedTransferTime) {
                logger.info(`Using recalculated transfer time for Multibanco payment:`, {
                  original: originalScheduledTime.toISOString(),
                  recalculated: recalculatedTransferTime.toISOString(),
                  diffHours: Math.floor(
                    (recalculatedTransferTime.getTime() - originalScheduledTime.getTime()) /
                      (60 * 60 * 1000),
                  ),
                });
              }

              // All validations passed, create transfer record
              await db.insert(PaymentTransfersTable).values({
                paymentIntentId: paymentIntent.id,
                checkoutSessionId: 'UNKNOWN', // Session ID not available in payment intent metadata per best practices
                eventId: meeting.eventId,
                expertConnectAccountId: transferData.account,
                expertWorkosUserId: meeting.workosUserId,
                amount: amount,
                platformFee: fee,
                currency: 'eur',
                sessionStartTime: meeting.startTime,
                scheduledTransferTime: scheduledTime, // 🆕 Uses recalculated time if available
                status: PAYMENT_TRANSFER_STATUS_READY,
                created: new Date(),
                updated: new Date(),
              });
              logger.info(`Created new transfer record for payment ${paymentIntent.id}`);
            } else {
              logger.error(
                `Missing required metadata for creating transfer record for PI ${paymentIntent.id}. Transfer Data: ${!!transferData}, Payment Data: ${!!paymentData}, Meeting: ${!!meeting}`,
              );
            }
          } else if (transfer.status === PAYMENT_TRANSFER_STATUS_PENDING) {
            // Update transfer status to READY with retry logic
            await withRetry(
              async () => {
                await db
                  .update(PaymentTransfersTable)
                  .set({
                    status: PAYMENT_TRANSFER_STATUS_READY,
                    updated: new Date(),
                  })
                  .where(eq(PaymentTransfersTable.id, transfer.id));
              },
              3,
              1000,
            );
            logger.info(`Transfer record ${transfer.id} status updated to READY.`);

            // Notify the expert about the successful payment
            await notifyExpertOfPaymentSuccess(transfer);

            // Also trigger Novu platform payments workflow for enhanced notifications
            try {
              const user = await db.query.UsersTable.findFirst({
                where: eq(UsersTable.workosUserId, transfer.expertWorkosUserId),
                columns: { workosUserId: true, username: true, email: true },
              });

              if (user) {
                const sessionDate = format(meeting.startTime, 'EEEE, MMMM d, yyyy');
                const amount = (transfer.amount / 100).toFixed(2); // Convert cents to euros

                const payload = {
                  amount,
                  clientName: meeting.guestName || 'Client',
                  sessionDate,
                  transactionId: paymentIntent.id,
                  dashboardUrl: '/account/billing',
                };

                await triggerWorkflow({
                  workflowId: 'platform-payments-universal',
                  to: {
                    subscriberId: user.workosUserId,
                    email: user.email || 'no-email@eleva.care',
                    firstName: '', // Removed: fetch from WorkOS if needed
                    lastName: '', // Removed: fetch from WorkOS if needed
                    data: {
                      paymentIntentId: paymentIntent.id,
                      role: 'expert',
                    },
                  },
                  payload,
                  actor: {
                    subscriberId: 'system',
                    data: {
                      source: 'stripe-webhook',
                      paymentIntentId: paymentIntent.id,
                      timestamp: new Date().toISOString(),
                    },
                  },
                });
                logger.info('Platform payment notification sent via Novu');
              }
            } catch (novuError) {
              logger.error('Failed to trigger platform payment notification', {
                error: novuError instanceof Error ? novuError.message : String(novuError),
              });
              // Don't fail the entire webhook for Novu errors
            }
          } else {
            logger.info(
              `Transfer record ${transfer.id} already in status ${transfer.status}, not updating to READY.`,
            );
          }

          // Send email notification to the guest
          if (meeting) {
            const meetingDetails = await db.query.MeetingsTable.findFirst({
              where: eq(MeetingsTable.stripePaymentIntentId, paymentIntent.id),
              with: {
                event: {
                  columns: {
                    name: true,
                    durationInMinutes: true,
                  },
                },
              },
            });

            // Fetch expert's PROFESSIONAL profile for patient-facing email
            const expertProfile = meetingDetails
              ? await db.query.ProfilesTable.findFirst({
                  where: eq(ProfilesTable.workosUserId, meetingDetails.workosUserId),
                  columns: {
                    firstName: true,
                    lastName: true,
                  },
                })
              : null;

            if (meetingDetails?.event && expertProfile) {
              const guestEmail = meetingDetails.guestEmail;
              const guestName = meetingDetails.guestName ?? 'Guest';
              const expertName =
                `${expertProfile.firstName} ${expertProfile.lastName}`.trim() || 'Our Expert';
              const eventName = meetingDetails.event.name;
              const meetingStartTime = meetingDetails.startTime; // Date object
              const meetingTimezone = meetingDetails.timezone || 'UTC'; // Default to UTC if not set
              const durationMinutes = meetingDetails.event.durationInMinutes;

              // Format date and time for the email
              const zonedStartTime = toZonedTime(meetingStartTime, meetingTimezone);
              const appointmentDate = format(zonedStartTime, 'EEEE, MMMM d, yyyy', {
                timeZone: meetingTimezone,
              });
              const startTimeFormatted = format(zonedStartTime, 'h:mm a', {
                timeZone: meetingTimezone,
              });

              const endTime = new Date(meetingStartTime.getTime() + durationMinutes * 60000);
              const zonedEndTime = toZonedTime(endTime, meetingTimezone);
              const endTimeFormatted = format(zonedEndTime, 'h:mm a', {
                timeZone: meetingTimezone,
              });

              const appointmentTime = `${startTimeFormatted} - ${endTimeFormatted} (${meetingTimezone})`;
              const appointmentDuration = `${durationMinutes} minutes`;

              try {
                logger.info(`Attempting to send payment confirmation email to ${guestEmail}`);
                const { html, text, subject } = await generateAppointmentEmail({
                  expertName,
                  clientName: guestName,
                  appointmentDate,
                  appointmentTime,
                  timezone: meetingTimezone,
                  appointmentDuration,
                  eventTitle: eventName,
                  meetLink: meetingDetails.meetingUrl ?? undefined,
                  notes: meetingDetails.guestNotes ?? undefined,
                  locale: extractLocaleFromPaymentIntent(paymentIntent),
                });

                await sendEmail({
                  to: guestEmail,
                  subject,
                  html,
                  text,
                });
                logger.info(
                  `Payment confirmation email successfully sent to ${guestEmail} for PI ${paymentIntent.id}`,
                );
              } catch (emailError) {
                logger.error(
                  `Failed to send payment confirmation email to ${guestEmail} for PI ${paymentIntent.id}`,
                  {
                    error: emailError instanceof Error ? emailError.message : String(emailError),
                  },
                );
                // Do not fail the entire webhook for email error
              }
            } else {
              logger.warn(
                `Could not retrieve all necessary details for PI ${paymentIntent.id} to send guest confirmation email. Meeting Details: ${!!meetingDetails}, Event: ${!!meetingDetails?.event}, Expert Profile: ${!!expertProfile}`,
              );
            }
          }
        }

        span.setAttribute('stripe.payment.success', true);
      } catch (error) {
        span.setAttribute('stripe.payment.success', false);
        Sentry.logger.error('Error in handlePaymentSucceeded', {
          paymentIntentId: paymentIntent.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Consider re-throwing if this error should halt further webhook processing or be retried by Stripe
      }
    },
  );
}

export async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  return Sentry.startSpan(
    {
      name: 'stripe.payment.failed',
      op: 'webhook.handler',
      attributes: {
        'stripe.payment_intent_id': paymentIntent.id,
        'stripe.amount': paymentIntent.amount,
        'stripe.currency': paymentIntent.currency,
        'stripe.status': paymentIntent.status,
        'stripe.error_code': paymentIntent.last_payment_error?.code || 'unknown',
      },
    },
    async (span) => {
      Sentry.logger.warn('Payment failed', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        errorCode: paymentIntent.last_payment_error?.code,
        errorMessage: paymentIntent.last_payment_error?.message,
      });
      const lastPaymentError = paymentIntent.last_payment_error?.message || 'Unknown reason';

      try {
        // Update Meeting status
        const updatedMeetings = await db
          .update(MeetingsTable)
          .set({
            stripePaymentStatus: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(MeetingsTable.stripePaymentIntentId, paymentIntent.id))
          .returning({
            id: MeetingsTable.id,
            workosUserId: MeetingsTable.workosUserId, // expert's WorkOS ID
            guestEmail: MeetingsTable.guestEmail,
            guestName: MeetingsTable.guestName,
            startTime: MeetingsTable.startTime,
            timezone: MeetingsTable.timezone,
            meetingUrl: MeetingsTable.meetingUrl,
            guestNotes: MeetingsTable.guestNotes,
            eventId: MeetingsTable.eventId,
          });

        const meetingDetails = updatedMeetings.length > 0 ? updatedMeetings[0] : null;

        if (!meetingDetails) {
          logger.warn(
            `No meeting found with paymentIntentId ${paymentIntent.id} to update status to failed. Proceeding with transfer update if applicable.`,
          );
        } else {
          logger.info(
            `Meeting ${meetingDetails.id} status updated to failed for paymentIntentId ${paymentIntent.id}`,
          );

          // Log Audit Event for meeting payment failure
          // Note: logAuditEvent requires user authentication context which is not available in webhooks
          // Webhook audit events are logged via console/Sentry for operational visibility
          logger.info('[AUDIT - WEBHOOK]', {
            action: 'PAYMENT_FAILED',
            resourceType: 'payment',
            resourceId: meetingDetails.id,
            details: {
              meetingId: meetingDetails.id,
              paymentIntentId: paymentIntent.id,
              guestEmail: meetingDetails.guestEmail,
              expertId: meetingDetails.workosUserId,
              failureReason: lastPaymentError,
            },
            source: 'stripe_webhook',
            timestamp: new Date().toISOString(),
          });
        }

        // Find the payment transfer record
        const transfer = await db.query.PaymentTransfersTable.findFirst({
          where: eq(PaymentTransfersTable.paymentIntentId, paymentIntent.id),
        });

        if (!transfer) {
          logger.error('No transfer record found for failed payment', {
            paymentIntentId: paymentIntent.id,
            note: 'This might be normal if the meeting was free or if transfer record creation failed earlier.',
          });
          // If meetingDetails exist, still try to notify guest
        } else if (
          transfer.status === PAYMENT_TRANSFER_STATUS_PENDING ||
          transfer.status === PAYMENT_TRANSFER_STATUS_READY
        ) {
          await withRetry(
            async () => {
              await db
                .update(PaymentTransfersTable)
                .set({
                  status: PAYMENT_TRANSFER_STATUS_FAILED,
                  stripeErrorMessage: lastPaymentError, // Store the failure reason
                  updated: new Date(),
                })
                .where(eq(PaymentTransfersTable.id, transfer.id));
            },
            3,
            1000,
          );
          logger.info(`Transfer record ${transfer.id} status updated to FAILED.`);

          // Notify the expert about the failed payment
          await notifyExpertOfPaymentFailure(
            transfer,
            paymentIntent.id,
            lastPaymentError,
            meetingDetails || undefined,
          );
        } else if (transfer) {
          logger.info(
            `Transfer record ${transfer.id} already in status ${transfer.status}, not updating to FAILED.`,
          );
        }

        // Send email notification to the guest about cancellation
        if (meetingDetails) {
          const eventInfo = await db.query.EventsTable.findFirst({
            where: eq(EventsTable.id, meetingDetails.eventId),
            columns: { name: true, durationInMinutes: true },
          });

          // Get expert's PROFESSIONAL profile for patient-facing email
          const expertProfile = await db.query.ProfilesTable.findFirst({
            where: eq(ProfilesTable.workosUserId, meetingDetails.workosUserId),
            columns: { firstName: true, lastName: true },
          });

          if (eventInfo && expertProfile) {
            const guestEmail = meetingDetails.guestEmail;
            const guestName = meetingDetails.guestName ?? 'Guest';
            const expertName =
              `${expertProfile.firstName} ${expertProfile.lastName}`.trim() || 'Our Expert';
            const eventName = eventInfo.name;
            const meetingStartTime = meetingDetails.startTime;
            const meetingTimezone = meetingDetails.timezone || 'UTC';
            const durationMinutes = eventInfo.durationInMinutes;

            const zonedStartTime = toZonedTime(meetingStartTime, meetingTimezone);
            const appointmentDate = format(zonedStartTime, 'EEEE, MMMM d, yyyy', {
              timeZone: meetingTimezone,
            });
            const startTimeFormatted = format(zonedStartTime, 'h:mm a', {
              timeZone: meetingTimezone,
            });
            const endTime = new Date(meetingStartTime.getTime() + durationMinutes * 60000);
            const zonedEndTime = toZonedTime(endTime, meetingTimezone);
            const endTimeFormatted = format(zonedEndTime, 'h:mm a', { timeZone: meetingTimezone });
            const appointmentTime = `${startTimeFormatted} - ${endTimeFormatted} (${meetingTimezone})`;
            const appointmentDuration = `${durationMinutes} minutes`;

            try {
              logger.info(`Attempting to send payment failed/cancellation email to ${guestEmail}`);
              const { html, text, subject } = await generateAppointmentEmail({
                expertName,
                clientName: guestName,
                appointmentDate,
                appointmentTime,
                timezone: meetingTimezone,
                appointmentDuration,
                eventTitle: eventName,
                meetLink: meetingDetails.meetingUrl ?? undefined, // May not be relevant if cancelled
                notes: `We regret to inform you that the payment for this scheduled meeting failed. Reason: ${lastPaymentError}. As a result, this meeting has been canceled. Please update your payment information and try booking again, or contact support if you believe this is an error.`,
                locale: extractLocaleFromPaymentIntent(paymentIntent),
              });

              await sendEmail({
                to: guestEmail,
                subject,
                html,
                text,
              });
              logger.info(
                `Payment failed/cancellation email successfully sent to ${guestEmail} for PI ${paymentIntent.id}`,
              );
            } catch (emailError) {
              logger.error(
                `Failed to send payment failed/cancellation email to ${guestEmail} for PI ${paymentIntent.id}`,
                {
                  error: emailError instanceof Error ? emailError.message : String(emailError),
                },
              );
            }
          } else {
            logger.warn(
              `Could not retrieve full event/expert details for meeting ${meetingDetails.id} to send guest cancellation email. Event: ${!!eventInfo}, Expert Profile: ${!!expertProfile}`,
            );
          }
        }

        span.setAttribute('stripe.payment_failed.handled', true);
      } catch (error) {
        Sentry.logger.error('Error in handlePaymentFailed', {
          paymentIntentId: paymentIntent.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}

export async function handleChargeRefunded(charge: Stripe.Charge) {
  return Sentry.startSpan(
    {
      name: 'stripe.charge.refunded',
      op: 'webhook.handler',
      attributes: {
        'stripe.charge_id': charge.id,
        'stripe.amount': charge.amount,
        'stripe.amount_refunded': charge.amount_refunded,
        'stripe.currency': charge.currency,
      },
    },
    async (span) => {
      Sentry.logger.info('Charge refunded', {
        chargeId: charge.id,
        amount: charge.amount,
        amountRefunded: charge.amount_refunded,
      });

      // Find the payment transfer record using the payment intent ID
      const paymentIntentId = charge.payment_intent;
      if (!paymentIntentId || typeof paymentIntentId !== 'string') {
        Sentry.logger.error('No payment_intent ID found on charge object', { chargeId: charge.id });
        return;
      }

      span.setAttribute('stripe.payment_intent_id', paymentIntentId);

      try {
        // Update Meeting status
        const updatedMeeting = await db
          .update(MeetingsTable)
          .set({
            stripePaymentStatus: 'refunded', // Ensure this matches the enum in MeetingsTable schema
            updatedAt: new Date(),
          })
          .where(eq(MeetingsTable.stripePaymentIntentId, paymentIntentId))
          .returning();

        if (updatedMeeting.length === 0) {
          Sentry.logger.warn('No meeting found to update status to refunded', { paymentIntentId });
        } else {
          span.setAttribute('stripe.meeting_id', updatedMeeting[0].id);
          Sentry.logger.info('Meeting status updated to refunded', {
            meetingId: updatedMeeting[0].id,
            paymentIntentId,
          });
        }

        // Find and update the payment transfer record
        const transfer = await db.query.PaymentTransfersTable.findFirst({
          where: eq(PaymentTransfersTable.paymentIntentId, paymentIntentId),
        });

        if (!transfer) {
          Sentry.logger.warn('No transfer record found for refunded payment', {
            paymentIntentId,
            note: 'This might be normal if the meeting was free or if transfer record creation failed earlier.',
          });
          return; // No transfer to update, but meeting status (if found) is updated.
        }

        // Update transfer status
        // No need for withRetry here usually as charge.refunded is a final state from Stripe's perspective.
        await db
          .update(PaymentTransfersTable)
          .set({
            status: PAYMENT_TRANSFER_STATUS_REFUNDED, // Ensure this matches PaymentTransfersTable schema/enum if any
            updated: new Date(),
          })
          .where(eq(PaymentTransfersTable.id, transfer.id));

        span.setAttribute('stripe.transfer_id', transfer.id);
        Sentry.logger.info('Transfer record status updated to REFUNDED', {
          transferId: transfer.id,
          paymentIntentId,
        });

        // Notify the expert about the refund
        await notifyExpertOfPaymentRefund(transfer);

        span.setAttribute('stripe.refund.handled', true);
      } catch (error) {
        Sentry.logger.error('Error in handleChargeRefunded', {
          chargeId: charge.id,
          paymentIntentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}

export async function handleDisputeCreated(dispute: Stripe.Dispute) {
  return Sentry.startSpan(
    {
      name: 'stripe.dispute.created',
      op: 'webhook.handler',
      attributes: {
        'stripe.dispute_id': dispute.id,
        'stripe.dispute_amount': dispute.amount,
        'stripe.dispute_reason': dispute.reason,
        'stripe.dispute_status': dispute.status,
      },
    },
    async (span) => {
      Sentry.logger.warn('Dispute created', {
        disputeId: dispute.id,
        amount: dispute.amount,
        reason: dispute.reason,
        status: dispute.status,
      });

      const paymentIntentId = dispute.payment_intent;

      if (!paymentIntentId || typeof paymentIntentId !== 'string') {
        Sentry.logger.error('No payment_intent ID found on dispute object', {
          disputeId: dispute.id,
        });
        return;
      }

      span.setAttribute('stripe.payment_intent_id', paymentIntentId);

      try {
        // Note: Meeting status is typically not directly changed to 'disputed'.
        // The existing payment status ('succeeded', 'refunded') often remains.
        // A dispute is a separate process on top of the payment.
        // So, we primarily update the transfer record.

        // Find and update the payment transfer record
        const transfer = await db.query.PaymentTransfersTable.findFirst({
          where: eq(PaymentTransfersTable.paymentIntentId, paymentIntentId),
        });

        if (!transfer) {
          Sentry.logger.error('No transfer record found for disputed payment', { paymentIntentId });
          return;
        }

        // Update transfer status
        await db
          .update(PaymentTransfersTable)
          .set({
            status: PAYMENT_TRANSFER_STATUS_DISPUTED, // Ensure this matches PaymentTransfersTable schema/enum
            updated: new Date(),
          })
          .where(eq(PaymentTransfersTable.id, transfer.id));

        span.setAttribute('stripe.transfer_id', transfer.id);
        Sentry.logger.info('Transfer record status updated to DISPUTED', {
          transferId: transfer.id,
          paymentIntentId,
        });

        // Create notification for the expert
        await notifyExpertOfPaymentDispute(transfer);

        span.setAttribute('stripe.dispute.handled', true);
      } catch (error) {
        Sentry.logger.error('Error in handleDisputeCreated', {
          disputeId: dispute.id,
          paymentIntentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}

export async function handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
  return Sentry.startSpan(
    {
      name: 'stripe.payment_intent.requires_action',
      op: 'webhook.handler',
      attributes: {
        'stripe.payment_intent_id': paymentIntent.id,
        'stripe.amount': paymentIntent.amount,
        'stripe.currency': paymentIntent.currency,
        'stripe.status': paymentIntent.status,
        'stripe.next_action_type': paymentIntent.next_action?.type || 'unknown',
      },
    },
    async (span) => {
      Sentry.logger.info('Payment intent requires action', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        nextActionType: paymentIntent.next_action?.type,
      });

      if (
        paymentIntent.next_action?.type === 'multibanco_display_details' &&
        ((typeof paymentIntent.payment_method === 'object' &&
          paymentIntent.payment_method?.type === 'multibanco') ||
          typeof paymentIntent.payment_method === 'string')
      ) {
        span.setAttribute('stripe.payment_method', 'multibanco');

        const multibancoDetails = paymentIntent.next_action.multibanco_display_details;
        const voucherExpiresAtTimestamp = multibancoDetails?.expires_at;

        if (voucherExpiresAtTimestamp && paymentIntent.metadata) {
          // Calculate expiration date from timestamp
          const voucherExpiresAt = new Date(voucherExpiresAtTimestamp * 1000);

          Sentry.logger.info('Multibanco voucher created', {
            paymentIntentId: paymentIntent.id,
            expiresAt: voucherExpiresAt.toISOString(),
          });

          // Create slot reservation for Multibanco payments
          try {
            const { eventId, workosUserId, selectedDate, selectedTime, customerEmail } =
              paymentIntent.metadata;

            if (!eventId || !workosUserId || !selectedDate || !selectedTime) {
              logger.error('Missing required metadata for slot reservation');
              return;
            }

            const startDateTime = new Date(`${selectedDate}T${selectedTime}`);

            // Get event details to calculate end time
            const event = await db
              .select()
              .from(EventsTable)
              .where(eq(EventsTable.id, eventId))
              .limit(1);

            if (event.length === 0) {
              logger.error(`Event ${eventId} not found`);
              return;
            }

            const endDateTime = new Date(startDateTime);
            endDateTime.setMinutes(endDateTime.getMinutes() + event[0].durationInMinutes);

            // Create slot reservation
            await db.insert(SlotReservationsTable).values({
              eventId,
              workosUserId,
              guestEmail: customerEmail || '',
              startTime: startDateTime,
              endTime: endDateTime,
              expiresAt: voucherExpiresAt,
              stripePaymentIntentId: paymentIntent.id,
            });

            logger.info(`Slot reservation created for payment intent ${paymentIntent.id}`);

            // Send Multibanco booking confirmation email
            if (customerEmail && multibancoDetails) {
              try {
                // Get expert details
                const expert = await db
                  .select({ workosUserId: UsersTable.workosUserId })
                  .from(UsersTable)
                  .where(eq(UsersTable.workosUserId, workosUserId))
                  .limit(1);

                if (expert.length === 0) {
                  logger.error(`Expert ${workosUserId} not found`);
                  return;
                }

                // Parse additional metadata
                const customerName = paymentIntent.metadata.customerName || 'Customer';
                const expertName = paymentIntent.metadata.expertName || 'Expert';
                const customerNotes = paymentIntent.metadata.customerNotes;

                // Format Multibanco details
                const multibancoEntity = multibancoDetails.entity || '';
                const multibancoReference = multibancoDetails.reference || '';
                const multibancoAmount = (paymentIntent.amount / 100).toFixed(2);
                const hostedVoucherUrl = multibancoDetails.hosted_voucher_url || '';

                // Format dates
                const appointmentDate = format(startDateTime, 'PPPP');
                const appointmentTime = format(startDateTime, 'p');
                const voucherExpiresFormatted = format(voucherExpiresAt, 'PPP p');

                // Extract locale for internationalization
                const locale = extractLocaleFromPaymentIntent(paymentIntent);

                // Render email template
                const emailHtml = await render(
                  MultibancoBookingPendingTemplate({
                    customerName,
                    expertName,
                    serviceName: event[0].name,
                    appointmentDate,
                    appointmentTime,
                    timezone: 'Europe/Lisbon', // Default for Multibanco
                    duration: event[0].durationInMinutes,
                    multibancoEntity,
                    multibancoReference,
                    multibancoAmount,
                    voucherExpiresAt: voucherExpiresFormatted,
                    hostedVoucherUrl,
                    customerNotes,
                    locale,
                  }),
                );

                // Send email using Resend
                const emailResult = await sendEmail({
                  to: customerEmail,
                  subject: `Booking Confirmed - Payment Required via Multibanco`,
                  html: emailHtml,
                });

                if (emailResult.success) {
                  Sentry.logger.info('Multibanco booking confirmation email sent', {
                    customerEmail,
                    paymentIntentId: paymentIntent.id,
                  });
                } else {
                  Sentry.logger.error('Failed to send Multibanco booking email', {
                    customerEmail,
                    paymentIntentId: paymentIntent.id,
                    error: emailResult.error,
                  });
                }
              } catch (emailError) {
                Sentry.logger.error('Error sending Multibanco booking confirmation email', {
                  customerEmail,
                  paymentIntentId: paymentIntent.id,
                  error: emailError instanceof Error ? emailError.message : 'Unknown error',
                });
              }
            }

            span.setAttribute('stripe.slot_reservation.created', true);
            Sentry.logger.info('Slot reservation created for Multibanco payment', {
              paymentIntentId: paymentIntent.id,
              eventId,
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              expiresAt: voucherExpiresAt.toISOString(),
            });
          } catch (error) {
            Sentry.logger.error('Error creating slot reservation', {
              paymentIntentId: paymentIntent.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    },
  );
}
