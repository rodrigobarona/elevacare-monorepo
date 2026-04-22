'use server';

import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { MeetingsTable } from '@/drizzle/schema';
import { triggerWorkflow } from '@/lib/integrations/novu/client';
import { createOrGetGuestUser } from '@/lib/integrations/workos/guest-users';
import { logAuditEvent } from '@/lib/utils/server/audit';
import { getValidTimesFromSchedule } from '@/lib/utils/server/scheduling';
import { meetingActionSchema } from '@/schema/meetings';
import GoogleCalendarService, { createCalendarEvent } from '@/server/googleCalendar';
import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { z } from 'zod';

/**
 * @fileoverview Server actions for managing meetings in the Eleva Care application.
 * This file handles the creation and management of meetings between experts and guests,
 * including validation, scheduling, payment processing, and Google Calendar integration.
 
 * Creates a new meeting between an expert and a guest.
 *
 * This function performs several validation and creation steps:
 * 1. Validates the incoming data against the meeting schema
 * 2. Checks for duplicate bookings from the same user
 * 3. Verifies the time slot is not already taken
 * 4. Validates the event exists and is active
 * 5. Verifies the time slot is valid according to the expert's schedule
 * 6. Creates a Google Calendar event
 * 7. Creates the meeting record in the database
 * 8. Logs the audit event
 *
 * @param unsafeData - The meeting data to be validated and processed
 * @returns An object containing:
 *   - error: boolean indicating if an error occurred
 *   - code?: error code if applicable
 *   - message?: error message if applicable
 *   - meeting?: the created meeting object if successful
 *
 * @example
 * const meetingData = {
 *   eventId: "event-123",
 *   workosUserId: "user-123",
 *   guestEmail: "guest@example.com",
 *   guestName: "John Doe",
 *   startTime: new Date(),
 *   timezone: "America/New_York",
 *   stripePaymentIntentId: "pi_123",
 *   stripePaymentStatus: "succeeded",
 *   stripeAmount: 5000
 * };
 *
 * const result = await createMeeting(meetingData);
 * if (result.error) {
 *   console.error("Meeting creation failed:", result.code);
 * } else {
 *   console.log("Meeting created:", result.meeting);
 * }
 *
 * @throws Will not throw errors directly, but returns error information in the result object
 */
export async function createMeeting(unsafeData: z.infer<typeof meetingActionSchema>) {
  return Sentry.withServerActionInstrumentation('createMeeting', { recordResponse: true }, async () => {
  const { success, data } = meetingActionSchema.safeParse(unsafeData);
  if (!success) {
    Sentry.logger.warn('Meeting creation validation failed', {
      eventId: unsafeData.eventId,
      guestEmail: unsafeData.guestEmail,
    });
    return { error: true, code: 'VALIDATION_ERROR' };
  }

  return Sentry.startSpan(
    {
      name: 'meeting.create',
      op: 'server.action',
      attributes: {
        'meeting.event_id': data.eventId,
        'meeting.guest_email': data.guestEmail,
        'meeting.has_payment': !!data.stripePaymentIntentId,
        'meeting.payment_status': data.stripePaymentStatus || 'free',
      },
    },
    async (parentSpan) => {
      Sentry.logger.info('Starting meeting creation', {
        eventId: data.eventId,
        guestEmail: data.guestEmail,
        hasPayment: !!data.stripePaymentIntentId,
      });

  try {
    // Step 1.5: Auto-create WorkOS user for guest (transparently during booking)
    const guestUserResult = await Sentry.startSpan(
          {
            name: 'meeting.create.guest_user',
            op: 'db.query',
            attributes: {
              'guest.email': data.guestEmail,
            },
          },
          async (span) => {
            Sentry.logger.debug('Auto-registering guest user in WorkOS', {
              email: data.guestEmail,
            });

            try {
              const result = await createOrGetGuestUser({
        email: data.guestEmail,
        name: data.guestName,
        metadata: {
          bookingEventId: data.eventId,
          bookingStartTime: data.startTime.toISOString(),
          registrationSource: 'meeting_booking',
        },
      });

              span.setAttribute('guest.is_new_user', result.isNewUser);

              if (result.isNewUser) {
                Sentry.logger.info('New guest user created', {
          email: data.guestEmail,
                  workosUserId: result.userId,
                  organizationId: result.organizationId,
        });
      } else {
                Sentry.logger.debug('Existing guest user found', {
          email: data.guestEmail,
                  workosUserId: result.userId,
        });
      }

              return result;
    } catch (guestUserError) {
              span.setAttribute('guest.error', true);
              Sentry.logger.error('Failed to create/get guest user', {
        error: guestUserError instanceof Error ? guestUserError.message : 'Unknown error',
        email: data.guestEmail,
      });
              throw guestUserError;
            }
          },
        );

        if (!guestUserResult) {
          parentSpan.setAttribute('meeting.success', false);
          parentSpan.setAttribute('meeting.error_code', 'GUEST_USER_CREATION_ERROR');
      return {
        error: true,
        code: 'GUEST_USER_CREATION_ERROR',
        message: 'Failed to register guest user',
      };
    }

    const guestWorkosUserId = guestUserResult.userId;
    const guestOrgId = guestUserResult.organizationId;

    // Step 2: Check for duplicate booking from the same user first
        const existingUserMeeting = await Sentry.startSpan(
          {
            name: 'meeting.create.check_duplicate',
            op: 'db.query',
          },
          async () => {
            return db.query.MeetingsTable.findFirst({
      where: (fields, operators) =>
        operators.or(
          data.stripePaymentIntentId
            ? operators.eq(fields.stripePaymentIntentId, data.stripePaymentIntentId)
            : undefined,
          data.stripeSessionId
            ? operators.eq(fields.stripeSessionId, data.stripeSessionId)
            : undefined,
          operators.and(
            operators.eq(fields.eventId, data.eventId),
            operators.eq(fields.startTime, data.startTime),
            operators.eq(fields.guestEmail, data.guestEmail),
          ),
        ),
    });
          },
        );

    if (existingUserMeeting) {
          parentSpan.setAttribute('meeting.is_duplicate', true);
          Sentry.logger.info('Duplicate booking from same user - returning existing meeting', {
        meetingId: existingUserMeeting.id,
        eventId: data.eventId,
        guestEmail: data.guestEmail,
      });
      return { error: false, meeting: existingUserMeeting };
    }

    // Step 3: Check if time slot is already taken by a different user
        const conflictingMeeting = await Sentry.startSpan(
          {
            name: 'meeting.create.check_conflict',
            op: 'db.query',
          },
          async () => {
            return db.query.MeetingsTable.findFirst({
      where: (fields, operators) =>
        operators.and(
          operators.eq(fields.eventId, data.eventId),
          operators.eq(fields.startTime, data.startTime),
          operators.ne(fields.guestEmail, data.guestEmail),
        ),
    });
          },
        );

    if (conflictingMeeting) {
          parentSpan.setAttribute('meeting.success', false);
          parentSpan.setAttribute('meeting.error_code', 'SLOT_ALREADY_BOOKED');
          Sentry.logger.warn('Time slot already taken by another user', {
        eventId: data.eventId,
            startTime: data.startTime.toISOString(),
        requestingUser: data.guestEmail,
            existingMeetingId: conflictingMeeting.id,
      });
      return {
        error: true,
        code: 'SLOT_ALREADY_BOOKED',
        message:
          'This time slot has just been booked by another user. Please choose a different time.',
      };
    }

    // Step 3.5: Check for active slot reservations by other users
        const conflictingReservation = await Sentry.startSpan(
          {
            name: 'meeting.create.check_reservation',
            op: 'db.query',
          },
          async () => {
            return db.query.SlotReservationsTable.findFirst({
      where: (fields, operators) =>
        operators.and(
          operators.eq(fields.eventId, data.eventId),
          operators.eq(fields.startTime, data.startTime),
          operators.ne(fields.guestEmail, data.guestEmail),
          operators.gt(fields.expiresAt, new Date()), // Only active reservations
        ),
    });
          },
        );

    if (conflictingReservation) {
          parentSpan.setAttribute('meeting.success', false);
          parentSpan.setAttribute('meeting.error_code', 'SLOT_TEMPORARILY_RESERVED');
          Sentry.logger.warn('Time slot is currently reserved by another user', {
        eventId: data.eventId,
            startTime: data.startTime.toISOString(),
        requestingUser: data.guestEmail,
            reservationId: conflictingReservation.id,
            expiresAt: conflictingReservation.expiresAt.toISOString(),
      });
      return {
        error: true,
        code: 'SLOT_TEMPORARILY_RESERVED',
        message:
          'This time slot is temporarily reserved by another user. Please choose a different time or try again later.',
      };
    }

    // Step 4: Find the associated event and verify it exists and is active
    const event = await db.query.EventsTable.findFirst({
      where: ({ workosUserId, isActive, id }, { eq, and }) =>
        and(eq(isActive, true), eq(workosUserId, data.workosUserId), eq(id, data.eventId)),
      with: {
        user: {
          with: {
            profile: true, // Include profile for name data in Novu notifications
          },
        },
      },
    });

        if (event == null) {
          parentSpan.setAttribute('meeting.success', false);
          parentSpan.setAttribute('meeting.error_code', 'EVENT_NOT_FOUND');
          Sentry.logger.warn('Event not found or inactive', {
            eventId: data.eventId,
            workosUserId: data.workosUserId,
          });
          return { error: true, code: 'EVENT_NOT_FOUND' };
        }

    // Step 5: Verify the requested time slot is valid according to the schedule
    const startTimeUTC = data.startTime;

    // 🔐 IMPORTANT: Skip time slot validation for already-paid bookings
    // When a webhook arrives with payment_status='succeeded', the customer has already paid
    // and we MUST honor the booking even if the schedule has changed since payment.
    // This prevents issues when webhooks are resent or delayed.
    const isAlreadyPaid = data.stripePaymentStatus === 'succeeded';
    const shouldSkipTimeValidation = isAlreadyPaid && data.stripeSessionId;

    if (!shouldSkipTimeValidation) {
          const isTimeSlotValid = await Sentry.startSpan(
            {
              name: 'meeting.create.validate_time_slot',
              op: 'validation',
            },
            async (span) => {
              Sentry.logger.debug('Validating time slot availability', {
                eventId: data.eventId,
                startTime: startTimeUTC.toISOString(),
              });

      // Get calendar events for the time slot
      const calendarService = GoogleCalendarService.getInstance();
              const calendarEvents = await calendarService.getCalendarEventTimes(
                event.workosUserId,
                {
        start: startTimeUTC,
        end: addMinutes(startTimeUTC, event.durationInMinutes),
                },
              );

              const validTimes = await getValidTimesFromSchedule(
                [startTimeUTC],
                event,
                calendarEvents,
              );

              span.setAttribute('time_slot.is_valid', validTimes.length > 0);
              return validTimes.length > 0;
            },
          );

          if (!isTimeSlotValid) {
            parentSpan.setAttribute('meeting.success', false);
            parentSpan.setAttribute('meeting.error_code', 'INVALID_TIME_SLOT');
            Sentry.logger.warn('Time slot validation failed', {
              requestedTime: startTimeUTC.toISOString(),
          eventId: data.eventId,
          guestEmail: data.guestEmail,
        });
        return { error: true, code: 'INVALID_TIME_SLOT' };
      }

          Sentry.logger.debug('Time slot is valid', { eventId: data.eventId });
    } else {
          Sentry.logger.info('Skipping time slot validation (payment already succeeded)', {
        paymentStatus: data.stripePaymentStatus,
        sessionId: data.stripeSessionId,
            bookingTime: startTimeUTC.toISOString(),
      });
    }

    // Step 6: Calculate the end time based on event duration
    const endTimeUTC = new Date(startTimeUTC.getTime() + event.durationInMinutes * 60000);

    try {
      let calendarEvent: Awaited<ReturnType<typeof createCalendarEvent>> | null = null;
      let meetingUrl: string | null = null;

      // Only create calendar events for succeeded payments or free events
      const shouldCreateCalendarEvent =
        !data.stripePaymentStatus ||
        data.stripePaymentStatus === 'succeeded' ||
        data.stripePaymentStatus === 'processing';

          Sentry.logger.debug('Calendar event creation decision', {
        shouldCreate: shouldCreateCalendarEvent,
            paymentStatus: data.stripePaymentStatus || 'free',
        eventId: data.eventId,
      });

      if (shouldCreateCalendarEvent) {
        // Step 7: Create calendar event in Google Calendar
            calendarEvent = await Sentry.startSpan(
              {
                name: 'meeting.create.calendar_event',
                op: 'http.client',
                attributes: {
                  'calendar.provider': 'google',
                },
              },
              async (span) => {
        try {
                  Sentry.logger.debug('Creating Google Calendar event', {
                    eventId: data.eventId,
                    guestEmail: data.guestEmail,
                  });

                  const result = await createCalendarEvent({
            workosUserId: data.workosUserId,
            guestName: data.guestName,
            guestEmail: data.guestEmail,
            startTime: startTimeUTC,
            guestNotes: data.guestNotes,
            durationInMinutes: event.durationInMinutes,
            eventName: event.name,
            timezone: data.timezone,
            locale: data.locale || 'en',
          });

                  const url = result.conferenceData?.entryPoints?.[0]?.uri ?? null;
                  span.setAttribute('calendar.has_meet_url', !!url);
                  span.setAttribute('calendar.has_conference_data', !!result.conferenceData);

                  Sentry.logger.info('Calendar event created successfully', {
                    eventId: data.eventId,
            paymentStatus: data.stripePaymentStatus || 'free',
                    hasMeetUrl: !!url,
          });

                  return result;
        } catch (calendarError) {
                  span.setAttribute('calendar.error', true);
                  Sentry.logger.error('Failed to create calendar event', {
                    error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
            eventId: data.eventId,
            workosUserId: data.workosUserId,
            guestEmail: data.guestEmail,
          });
          // Don't fail the meeting creation - calendar can be created later
                  return null;
                }
              },
            );

            if (calendarEvent) {
              meetingUrl = calendarEvent.conferenceData?.entryPoints?.[0]?.uri ?? null;
        }
      } else {
            Sentry.logger.info('Calendar event deferred', {
              paymentStatus: data.stripePaymentStatus,
              eventId: data.eventId,
            });
      }

      // Step 8: Create the meeting record in the database
          const [meeting] = await Sentry.startSpan(
            {
              name: 'meeting.create.db_insert',
              op: 'db.insert',
            },
            async () => {
              return db
        .insert(MeetingsTable)
        .values({
          eventId: data.eventId,
          workosUserId: data.workosUserId, // Expert's WorkOS ID
          guestWorkosUserId, // Guest's WorkOS ID (auto-created)
          guestOrgId, // Guest's organization ID (auto-created)
          guestEmail: data.guestEmail, // Keep for backward compatibility
          guestName: data.guestName, // Keep for backward compatibility
          guestNotes: data.guestNotes,
          startTime: startTimeUTC,
          endTime: endTimeUTC,
          timezone: data.timezone,
          meetingUrl: meetingUrl,
          stripePaymentIntentId: data.stripePaymentIntentId,
          stripeSessionId: data.stripeSessionId,
          stripePaymentStatus: data.stripePaymentStatus as
            | 'pending'
            | 'processing'
            | 'succeeded'
            | 'failed'
            | 'refunded',
          stripeAmount: data.stripeAmount,
          stripeApplicationFeeAmount: data.stripeApplicationFeeAmount,
        })
        .returning();
            },
          );

          parentSpan.setAttribute('meeting.id', meeting.id);
          parentSpan.setAttribute('meeting.success', true);

          Sentry.logger.info('Meeting created successfully', {
            meetingId: meeting.id,
            eventId: data.eventId,
            guestEmail: data.guestEmail,
            hasMeetUrl: !!meetingUrl,
          });

      // Step 9: Log audit event (user context automatically extracted)
      await logAuditEvent(
        'APPOINTMENT_CREATED',
        'appointment',
        meeting.id,
        {
          newValues: {
            ...data,
            endTime: endTimeUTC,
            meetingUrl: meetingUrl,
            calendarEventCreated: shouldCreateCalendarEvent,
          },
        },
        { eventId: data.eventId },
      );

      // Step 10: Fetch expert's timezone and trigger Novu workflow for expert notification
          await Sentry.startSpan(
            {
              name: 'meeting.create.send_notification',
              op: 'notification',
            },
            async (span) => {
      try {
        // CRITICAL: Fetch expert's timezone from their schedule settings
        const expertSchedule = await db.query.SchedulesTable.findFirst({
          where: (fields, { eq: eqOp }) => eqOp(fields.workosUserId, data.workosUserId),
        });

        const expertTimezone = expertSchedule?.timezone || 'UTC';
        const guestTimezone = data.timezone || 'UTC';

        // Format date and time for the EXPERT in THEIR timezone
        const appointmentDateForExpert = formatInTimeZone(
          startTimeUTC,
          expertTimezone,
          'EEEE, MMMM d, yyyy',
        );
                const appointmentTimeForExpert = formatInTimeZone(
                  startTimeUTC,
                  expertTimezone,
                  'h:mm a',
                );
        const appointmentDuration = `${event.durationInMinutes} minutes`;

        // Trigger Novu workflow to notify the expert (with EXPERT's timezone)
        const novuResult = await triggerWorkflow({
          workflowId: 'appointment-confirmation',
          to: {
            subscriberId: data.workosUserId, // Expert's WorkOS ID
            email: event.user?.email || undefined,
            firstName: event.user?.profile?.firstName || undefined,
            lastName: event.user?.profile?.lastName || undefined,
          },
          payload: {
            expertName:
              `${event.user?.profile?.firstName || ''} ${event.user?.profile?.lastName || ''}`.trim() ||
              'Expert',
            clientName: data.guestName,
            appointmentDate: appointmentDateForExpert, // ✅ Expert's timezone
            appointmentTime: appointmentTimeForExpert, // ✅ Expert's timezone
            timezone: expertTimezone, // ✅ Expert's timezone for display
            guestTimezone: guestTimezone, // Store guest's timezone for reference
            appointmentDuration,
            eventTitle: event.name,
            meetLink: meetingUrl || undefined,
            notes: data.guestNotes || undefined,
            locale: data.locale || 'en',
          },
        });

                span.setAttribute('notification.sent', !!novuResult);

        if (novuResult) {
                  Sentry.logger.info('Novu appointment confirmation sent to expert', {
                    workosUserId: data.workosUserId,
                    meetingId: meeting.id,
                  });
        } else {
                  Sentry.logger.warn('Failed to send Novu notification to expert', {
                    workosUserId: data.workosUserId,
                    meetingId: meeting.id,
                  });
        }
      } catch (novuError) {
                span.setAttribute('notification.error', true);
        // Don't fail the whole meeting creation if Novu fails
                Sentry.logger.error('Error sending Novu notification', {
                  error: novuError instanceof Error ? novuError.message : 'Unknown error',
                  workosUserId: data.workosUserId,
                  meetingId: meeting.id,
                });
      }
            },
          );

      return { error: false, meeting };
    } catch (error) {
          parentSpan.setAttribute('meeting.success', false);
          parentSpan.setAttribute('meeting.error_code', 'CREATION_ERROR');
          Sentry.logger.error('Error creating meeting', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: data.eventId,
            startTime: data.startTime.toISOString(),
        guestEmail: data.guestEmail,
        workosUserId: data.workosUserId,
      });
      return { error: true, code: 'CREATION_ERROR' };
    }
  } catch (error) {
        parentSpan.setAttribute('meeting.success', false);
        parentSpan.setAttribute('meeting.error_code', 'UNEXPECTED_ERROR');
        Sentry.logger.error('Unexpected error in createMeeting', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: unsafeData.eventId,
      workosUserId: unsafeData.workosUserId,
      guestEmail: unsafeData.guestEmail,
    });
    return { error: true, code: 'UNEXPECTED_ERROR' };
  }
    },
  );
  });
}
