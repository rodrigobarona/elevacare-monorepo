/**
 * Google Calendar Integration Service
 *
 * ✅ MIGRATED TO WORKOS + DATABASE-BACKED ENCRYPTED TOKENS ✅
 *
 * This module provides a production-ready service for integrating with Google Calendar API.
 * It handles OAuth authentication via WorkOS, event management, and meeting creation.
 *
 * 🔐 Security Features:
 * - All OAuth tokens encrypted with AES-256-GCM (same as medical records)
 * - Database-backed token storage (not session-based)
 * - Automatic token refresh via Google Auth Library
 * - Token revocation on disconnect
 * - HIPAA/GDPR compliant encryption
 *
 * 🏗️ Architecture:
 * - OAuth Flow: WorkOS → Database (encrypted) → Application
 * - Token Management: lib/integrations/google/oauth-tokens.ts
 * - User Data: Database queries (UsersTable + ProfilesTable)
 * - Calendar API: Google Calendar API v3
 *
 * 📚 Documentation:
 * - Implementation Guide: docs/09-integrations/IMPLEMENTATION-COMPLETE.md
 * - Migration Guide: docs/09-integrations/google-calendar-workos-migration.md
 * - Encryption Details: docs/09-integrations/ENCRYPTION-IMPLEMENTATION.md
 * - WorkOS Setup: docs/09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md
 *
 * The service is implemented as a singleton to maintain a consistent instance
 * throughout the application.
 *
 * @module GoogleCalendarService
 */
import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';

const { logger } = Sentry;
import { createShortMeetLink } from '@/lib/integrations/dub/client';
import { getGoogleOAuthClient } from '@/lib/integrations/google/oauth-tokens';
import { generateAppointmentEmail, sendEmail } from '@/lib/integrations/novu/email';
import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { eq } from 'drizzle-orm';
import { google } from 'googleapis';

/**
 * Validates if a timezone string is valid by attempting to use it with Intl.DateTimeFormat
 * @param tz Timezone string to validate
 * @returns Boolean indicating if the timezone is valid
 */
function isValidTimezone(tz: string): boolean {
  if (!tz) return false;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * GoogleCalendarService - Singleton service for Google Calendar integration
 *
 * This class manages Google Calendar operations including:
 * - OAuth authentication with WorkOS
 * - Fetching calendar events
 * - Creating new calendar events with Google Meet
 * - Sending email notifications for appointments
 */
class GoogleCalendarService {
  private static instance: GoogleCalendarService | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of GoogleCalendarService
   * @returns The GoogleCalendarService instance
   */
  static getInstance(): GoogleCalendarService {
    if (!GoogleCalendarService.instance) {
      GoogleCalendarService.instance = new GoogleCalendarService();
    }
    return GoogleCalendarService.instance;
  }

  /**
   * Gets an authenticated OAuth client for Google API
   *
   * Uses database-backed encrypted tokens (via WorkOS OAuth) to create
   * an authenticated Google OAuth client with automatic token refresh
   *
   * @param workosUserId WorkOS user ID to obtain OAuth client for
   * @returns Configured Google OAuth client with auto-refresh
   * @throws Error if no OAuth token found or unable to obtain client
   */
  async getOAuthClient(workosUserId: string) {
    try {
      // Get authenticated OAuth client from token management service
      // This handles decryption, token refresh, and re-encryption automatically
      const oAuthClient = await getGoogleOAuthClient(workosUserId);

      if (!oAuthClient) {
        throw new Error('No Google Calendar connection found for user');
      }

      return oAuthClient;
    } catch (error) {
      logger.error('Error obtaining OAuth client', { error });
      throw new Error(
        'Unable to obtain Google OAuth client. Please connect your Google Calendar in settings.',
      );
    }
  }

  /**
   * Queries busy time ranges for a user's primary calendar within a time range
   *
   * Uses the Google Calendar FreeBusy API, which returns only busy/free time
   * ranges without exposing any event content (titles, descriptions, attendees).
   * Google handles filtering of transparent and cancelled events server-side.
   *
   * @param workosUserId WorkOS user ID to query availability for
   * @param options Object containing start and end dates for the time range
   * @returns Array of busy time ranges with start and end times
   */
  async getCalendarEventTimes(workosUserId: string, { start, end }: { start: Date; end: Date }) {
    const oAuthClient = await this.getOAuthClient(workosUserId);

    logger.info('Fetching calendar availability', {
      timeRange: { start: start.toISOString(), end: end.toISOString() },
      userId: workosUserId,
    });

    const response = await google.calendar('v3').freebusy.query({
      auth: oAuthClient,
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.['primary']?.busy ?? [];

    logger.info('FreeBusy query completed', {
      busySlots: busySlots.length,
      userId: workosUserId,
    });

    return busySlots
      .filter(
        (slot): slot is { start: string; end: string } => slot.start != null && slot.end != null,
      )
      .map((slot) => ({
        start: new Date(slot.start),
        end: new Date(slot.end),
      }));
  }

  /**
   * Creates a new calendar event with Google Meet integration
   *
   * This comprehensive method:
   * 1. Creates a Google Calendar event with Google Meet
   * 2. Shortens the Meet link using Dub.co
   * 3. Updates the event description with the shortened link
   * 4. Sends email notifications to both the expert and client
   *
   * @param params Event creation parameters
   * @param params.workosUserId WorkOS user ID of the calendar owner (expert)
   * @param params.guestName Name of the guest/client
   * @param params.guestEmail Email of the guest/client
   * @param params.startTime Start time of the appointment
   * @param params.guestNotes Optional notes from the guest
   * @param params.durationInMinutes Duration of the appointment in minutes
   * @param params.eventName Name/title of the event
   * @param params.timezone Optional timezone for display formatting (falls back to UTC if invalid)
   * @param params.locale Optional locale for email formatting (defaults to 'en')
   * @returns Created calendar event data with additional meet link information
   */
  async createCalendarEvent({
    workosUserId,
    guestName,
    guestEmail,
    startTime,
    guestNotes,
    durationInMinutes,
    eventName,
    timezone: providedTimezone,
    locale = 'en',
  }: {
    workosUserId: string;
    guestName: string;
    guestEmail: string;
    startTime: Date;
    guestNotes?: string | null;
    durationInMinutes: number;
    eventName: string;
    timezone?: string;
    locale?: string;
  }) {
    // Get authenticated OAuth client
    const oAuthClient = await this.getOAuthClient(workosUserId);

    // Get user information from database
    const calendarUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
      with: {
        profile: true,
      },
    });

    if (!calendarUser) {
      throw new Error('User not found');
    }

    if (!calendarUser.email) {
      throw new Error('User has no email address');
    }

    // Extract user details for calendar event
    const fullName =
      calendarUser.profile?.firstName && calendarUser.profile?.lastName
        ? `${calendarUser.profile.firstName} ${calendarUser.profile.lastName}`
        : calendarUser.email.split('@')[0]; // Fallback to email username

    const userEmail = calendarUser.email;

    // Generate a descriptive summary
    const eventSummary = `${guestName} + ${fullName}: ${eventName}`;

    // Format date and time with proper timezone support
    const formatDate = (date: Date, tz: string) => formatInTimeZone(date, tz, 'EEEE, MMMM d, yyyy');

    const formatTime = (date: Date, duration: number, tz: string) => {
      const endTime = addMinutes(date, duration);
      return `${formatInTimeZone(date, tz, 'h:mm a')} - ${formatInTimeZone(endTime, tz, 'h:mm a')}`;
    };

    // Get timezone information
    let timezone = 'UTC';

    // First try the provided timezone
    if (providedTimezone && isValidTimezone(providedTimezone)) {
      timezone = providedTimezone;
    } else if (providedTimezone) {
      logger.warn(logger.fmt`Invalid timezone provided: ${providedTimezone}, falling back to defaults`);
    }

    // If no valid timezone provided, try to get from other sources
    if (timezone === 'UTC') {
      try {
        // Try to get from Intl API first
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTimezone && isValidTimezone(detectedTimezone)) {
          timezone = detectedTimezone;
        }

        // Note: User timezone is stored in SchedulingSettingsTable, not ProfilesTable
        // We use the provided timezone parameter or fall back to detected timezone
        // For future enhancement, could query SchedulingSettingsTable for user's preferred timezone
      } catch (error) {
        logger.warn('Error getting timezone, using UTC', { error });
      }
    }

    logger.debug('Using validated timezone', { timezone });

    // Format for display with the validated timezone
    const appointmentDate = formatDate(startTime, timezone);
    const appointmentTime = formatTime(startTime, durationInMinutes, timezone);
    const formattedDuration = `${durationInMinutes} minutes`;

    logger.debug('Creating calendar event with timezone', {
      datetime: startTime.toISOString(),
      timezone,
      localizedTime: formatInTimeZone(startTime, timezone, 'PPpp'),
      formattedDate: appointmentDate,
      formattedTime: appointmentTime,
    });

    // Create the actual calendar event
    const calendarEvent = await google.calendar('v3').events.insert({
      calendarId: 'primary',
      auth: oAuthClient,
      sendUpdates: 'all',
      requestBody: {
        // Set up attendees (guest and calendar owner)
        attendees: [
          {
            email: guestEmail,
            displayName: guestName,
            responseStatus: 'accepted',
          },
          {
            email: userEmail,
            displayName: fullName,
            responseStatus: 'accepted',
            organizer: true,
            optional: false,
          },
        ],
        description: guestNotes ? `Additional Details: ${guestNotes}` : undefined,
        start: {
          dateTime: startTime.toISOString(),
        },
        end: {
          dateTime: addMinutes(startTime, durationInMinutes).toISOString(),
        },
        summary: eventSummary,
        // Set up Google Meet integration
        conferenceData: {
          createRequest: {
            requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        // Security and permissions settings
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: true,
        // Reminder settings - these apply to the calendar owner (expert)
        // Guests will receive standard calendar notifications based on their settings
        // Note: Google Calendar API doesn't allow setting reminders for guests directly
        // Guests will get notifications based on their Google Calendar preferences
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 }, // 1 hour before
            { method: 'email', minutes: 15 }, // 15 minutes before
            { method: 'popup', minutes: 5 }, // 5 minutes before
          ],
        },
      },
      conferenceDataVersion: 1,
    });

    // Check if a Google Meet link was created and shorten it with Dub.co
    let meetLink = '';
    let shortMeetLink = '';

    if (calendarEvent.data.conferenceData?.conferenceId) {
      // Extract the Google Meet link
      meetLink = calendarEvent.data.hangoutLink || '';

      if (meetLink) {
        try {
          // Create a shortened URL with tracking parameters
          shortMeetLink = await createShortMeetLink({
            url: meetLink,
            expertName: fullName || undefined,
            expertUsername: calendarUser.username || undefined,
          });

          logger.info('Generated short meet link', { shortMeetLink });

          // Update the calendar event description to include the shortened link
          if (shortMeetLink && shortMeetLink !== meetLink) {
            const updatedDescription = `Join the meeting: ${shortMeetLink}\n\n${
              calendarEvent.data.description || guestNotes
                ? `Additional Details: ${guestNotes}`
                : ''
            }`;

            // Update the calendar event with the new description
            await google.calendar('v3').events.patch({
              calendarId: 'primary',
              eventId: calendarEvent.data.id || '',
              auth: oAuthClient,
              requestBody: {
                description: updatedDescription,
              },
            });

            // Update the local event data
            calendarEvent.data.description = updatedDescription;
          }
        } catch (error) {
          logger.error('Error processing Meet link', { error });
          // Continue with the original Meet link if shortening fails
        }
      }
    }

    try {
      // After creating the event, send an immediate email notification to the expert
      logger.info('Event created, sending email notification to expert', {
        expertEmail: userEmail,
        eventId: calendarEvent?.data?.id,
        eventSummary: eventSummary,
        timezone,
        locale,
      });

      // Generate the email content for the expert
      const expertEmailContent = await generateAppointmentEmail({
        expertName: fullName || 'Expert',
        clientName: guestName,
        appointmentDate,
        appointmentTime,
        timezone,
        appointmentDuration: formattedDuration,
        eventTitle: eventName,
        meetLink: shortMeetLink || meetLink || undefined,
        notes: guestNotes ? guestNotes : undefined,
        locale,
      });

      logger.debug('Generated expert email content', {
        subject: expertEmailContent.subject,
        hasHtml: !!expertEmailContent.html,
        hasText: !!expertEmailContent.text,
      });

      // Send the expert notification
      const expertEmailResult = await sendEmail({
        to: userEmail,
        subject: expertEmailContent.subject,
        html: expertEmailContent.html,
        text: expertEmailContent.text,
      });

      if (!expertEmailResult.success) {
        logger.error('Failed to send expert notification email', {
          error: expertEmailResult.error,
          to: userEmail,
        });
      } else {
        logger.info('Expert notification email sent successfully', {
          messageId: expertEmailResult.messageId,
          to: userEmail,
        });
      }

      // Also send notification to the client
      logger.info('Sending email notification to client', {
        clientEmail: guestEmail,
        eventId: calendarEvent?.data?.id,
        eventSummary: eventSummary,
        timezone,
        locale,
      });

      // Generate client email
      const clientEmailContent = await generateAppointmentEmail({
        expertName: fullName || 'Expert',
        clientName: guestName,
        appointmentDate,
        appointmentTime,
        timezone,
        appointmentDuration: formattedDuration,
        eventTitle: eventName,
        meetLink: shortMeetLink || meetLink || undefined,
        notes: guestNotes ? guestNotes : undefined,
        locale,
      });

      logger.debug('Generated client email content', {
        subject: clientEmailContent.subject,
        hasHtml: !!clientEmailContent.html,
        hasText: !!clientEmailContent.text,
      });

      const clientEmailResult = await sendEmail({
        to: guestEmail,
        subject: clientEmailContent.subject,
        html: clientEmailContent.html,
        text: clientEmailContent.text,
      });

      if (!clientEmailResult.success) {
        logger.error('Failed to send client notification email', {
          error: clientEmailResult.error,
          to: guestEmail,
        });
      } else {
        logger.info('Client notification email sent successfully', {
          messageId: clientEmailResult.messageId,
          to: guestEmail,
        });
      }
    } catch (error) {
      logger.error('Error sending notifications', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't fail the whole operation if just the email notification fails
    }

    // Add the original and shortened Meet links to the returned data
    return {
      ...calendarEvent.data,
      meetLink,
      shortMeetLink,
    };
  }

  /**
   * Checks if a user has valid Google OAuth tokens
   *
   * Verifies that the specified user has connected their Google account
   * and that encrypted OAuth tokens are available in the database
   *
   * @param workosUserId WorkOS user ID to check for valid tokens
   * @returns True if valid tokens exist, false otherwise
   */
  async hasValidTokens(workosUserId: string): Promise<boolean> {
    try {
      // Try to get OAuth client - if it succeeds, tokens are valid
      await this.getOAuthClient(workosUserId);
      return true;
    } catch {
      return false;
    }
  }
}

export { GoogleCalendarService as default };

/**
 * Creates a new calendar event with Google Meet integration
 *
 * This is a convenience wrapper around the GoogleCalendarService.createCalendarEvent method
 *
 * @param params Event creation parameters
 * @param params.workosUserId WorkOS user ID of the calendar owner (expert)
 * @param params.guestName Name of the guest/client
 * @param params.guestEmail Email of the guest/client
 * @param params.startTime Start time of the appointment
 * @param params.guestNotes Optional notes from the guest
 * @param params.durationInMinutes Duration of the appointment in minutes
 * @param params.eventName Name/title of the event
 * @param params.timezone Optional timezone for display formatting (falls back to UTC if invalid)
 * @param params.locale Optional locale for email formatting (defaults to 'en')
 * @returns Created calendar event data with additional meet link information
 */
export async function createCalendarEvent(params: {
  workosUserId: string;
  guestName: string;
  guestEmail: string;
  startTime: Date;
  guestNotes?: string | null;
  durationInMinutes: number;
  eventName: string;
  timezone?: string; // Will be validated - invalid timezones will fall back to UTC
  locale?: string; // Add locale parameter
}) {
  return GoogleCalendarService.getInstance().createCalendarEvent(params);
}

/**
 * Gets a Google Calendar client for a specific user
 *
 * Obtains encrypted OAuth tokens from database and creates a configured
 * Google Calendar client with automatic token refresh
 *
 * @param workosUserId WorkOS user ID to create the client for
 * @returns Configured Google Calendar client with auto-refresh
 * @throws Error if no access token found or client creation fails
 */
export async function getGoogleCalendarClient(workosUserId: string) {
  try {
    // Get authenticated OAuth client (handles decryption and refresh)
    const auth = await getGoogleOAuthClient(workosUserId);

    if (!auth) {
      throw new Error('No Google Calendar connection found. Please connect in settings.');
    }

    return google.calendar({
      version: 'v3',
      auth,
    });
  } catch (error) {
    logger.error('Error obtaining Google Calendar client', { error });
    throw error;
  }
}
