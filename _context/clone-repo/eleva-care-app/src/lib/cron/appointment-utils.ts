/**
 * Shared utilities for appointment reminder cron jobs
 *
 * Contains common interfaces, queries, and formatting functions
 * used by both 24-hour and 1-hour reminder routes.
 *
 * @module lib/cron/appointment-utils
 *
 * @example
 * ```typescript
 * import {
 *   getUpcomingAppointments,
 *   formatDateTime,
 *   formatTimeUntilAppointment,
 * } from '@/lib/cron/appointment-utils';
 *
 * // Fetch appointments 24-25 hours from now
 * const appointments = await getUpcomingAppointments(24 * 60, 25 * 60);
 *
 * for (const apt of appointments) {
 *   const { datePart, timePart } = formatDateTime(
 *     apt.startTime,
 *     apt.expertTimezone,
 *     apt.expertLocale,
 *   );
 *   console.log(`Appointment: ${datePart} at ${timePart}`);
 * }
 * ```
 */
import { db } from '@/drizzle/db';
import {
  EventsTable,
  MeetingsTable,
  ProfilesTable,
  SchedulesTable,
  UsersTable,
} from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { and, between, eq } from 'drizzle-orm';

const { logger } = Sentry;

/**
 * Appointment data structure used by reminder cron jobs.
 *
 * Represents a fully-hydrated appointment with all necessary
 * information for sending reminders to both experts and patients.
 *
 * @interface Appointment
 *
 * @property {string} id - Unique meeting identifier (UUID)
 * @property {string} guestEmail - Patient/guest email address
 * @property {string} customerWorkosId - Guest's WorkOS ID if available, or 'guest'
 * @property {string} expertWorkosId - Expert's WorkOS user ID (for Novu notifications)
 * @property {string} customerName - Patient/guest display name
 * @property {string} expertName - Expert's full name
 * @property {string} appointmentType - Event/service name (e.g., "Physical Therapy Session")
 * @property {Date} startTime - Appointment start time (UTC)
 * @property {Date} endTime - Appointment end time (UTC)
 * @property {number} durationMinutes - Duration of the appointment
 * @property {string} meetingUrl - Google Meet or video call URL
 * @property {string} customerLocale - Locale for patient communications (e.g., 'en-US')
 * @property {string} expertLocale - Locale for expert communications (e.g., 'pt-PT')
 * @property {string} customerTimezone - IANA timezone for patient (e.g., 'Europe/Lisbon')
 * @property {string} expertTimezone - IANA timezone for expert (from schedule or meeting)
 */
export interface Appointment {
  id: string;
  guestEmail: string;
  customerWorkosId: string;
  expertWorkosId: string;
  customerName: string;
  expertName: string;
  appointmentType: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  meetingUrl: string;
  customerLocale: string;
  expertLocale: string;
  customerTimezone: string;
  expertTimezone: string;
}

/**
 * Supported locale type for email templates and notifications.
 * Re-exported here for convenience in cron job files.
 */
export type SupportedLocale = 'en' | 'pt' | 'es';

/**
 * Normalizes a locale string to one of the supported locales ('en', 'pt', 'es').
 *
 * This helper centralizes the locale normalization logic used across cron jobs
 * to ensure consistent locale handling for email templates and notifications.
 *
 * @param {string | null | undefined} locale - The locale string to normalize (e.g., 'pt-PT', 'en-US')
 * @returns {SupportedLocale} Normalized locale ('en', 'pt', or 'es')
 *
 * @example
 * ```typescript
 * normalizeLocale('pt-PT');     // 'pt'
 * normalizeLocale('pt-BR');     // 'pt'
 * normalizeLocale('es-ES');     // 'es'
 * normalizeLocale('en-US');     // 'en'
 * normalizeLocale(null);        // 'en'
 * normalizeLocale(undefined);   // 'en'
 * ```
 */
export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  const localeLower = (locale || 'en').toLowerCase();
  if (localeLower.startsWith('pt')) return 'pt';
  if (localeLower.startsWith('es')) return 'es';
  return 'en';
}

/**
 * Determines locale based on country code.
 *
 * Maps ISO 3166-1 alpha-2 country codes to BCP 47 locale strings.
 * Defaults to 'en-US' for unknown countries.
 *
 * @param {string | null} country - ISO 3166-1 alpha-2 country code (e.g., 'PT', 'BR')
 * @returns {string} BCP 47 locale string (e.g., 'pt-PT', 'en-US')
 *
 * @example
 * ```typescript
 * getLocaleFromCountry('PT'); // 'pt-PT'
 * getLocaleFromCountry('BR'); // 'pt-BR'
 * getLocaleFromCountry('ES'); // 'es-ES'
 * getLocaleFromCountry('US'); // 'en-US'
 * getLocaleFromCountry(null); // 'en-US'
 * ```
 */
export function getLocaleFromCountry(country: string | null): string {
  switch (country?.toUpperCase()) {
    case 'PT':
      return 'pt-PT';
    case 'BR':
      return 'pt-BR';
    case 'ES':
      return 'es-ES';
    default:
      return 'en-US';
  }
}

/**
 * Safely creates an Intl.DateTimeFormat instance with fallback.
 * Falls back to en-US with UTC timezone if the provided locale or timezone is invalid.
 *
 * @param {string} locale - BCP 47 locale string
 * @param {Intl.DateTimeFormatOptions} options - Formatting options
 * @returns {Intl.DateTimeFormat} A valid DateTimeFormat instance
 */
function safeCreateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    // Fallback to en-US with UTC timezone for invalid locale/timezone
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  }
}

/**
 * Formats a date into separate date and time parts for a given timezone and locale.
 *
 * Uses `Intl.DateTimeFormat` to produce localized, timezone-aware date strings.
 * Returns separate parts for flexible email template rendering.
 *
 * @param {Date} date - The date to format (UTC)
 * @param {string} timezone - IANA timezone identifier (e.g., 'Europe/Lisbon')
 * @param {string} locale - BCP 47 locale string (e.g., 'pt-PT', 'en-US')
 * @returns {{ datePart: string; timePart: string }} Formatted date and time strings
 *
 * @example
 * ```typescript
 * const apptTime = new Date('2026-01-25T10:30:00Z');
 *
 * // Portuguese format
 * formatDateTime(apptTime, 'Europe/Lisbon', 'pt-PT');
 * // { datePart: 'Saturday, 25 January 2026', timePart: '10:30 AM WET' }
 *
 * // English format
 * formatDateTime(apptTime, 'America/New_York', 'en-US');
 * // { datePart: 'Saturday, January 25, 2026', timePart: '05:30 AM EST' }
 * ```
 */
export function formatDateTime(
  date: Date,
  timezone: string,
  locale: string,
): { datePart: string; timePart: string } {
  // Use normalizeLocale for consistent locale handling
  const normalizedLocale = normalizeLocale(locale);
  const use12HourFormat = normalizedLocale === 'en';

  // Use safeCreateFormatter to handle invalid locale/timezone gracefully
  const dateFormatter = safeCreateFormatter(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const timeFormatter = safeCreateFormatter(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: use12HourFormat,
    timeZoneName: 'short',
  });

  return {
    datePart: dateFormatter.format(date),
    timePart: timeFormatter.format(date),
  };
}

/**
 * Formats a human-readable "time until appointment" string.
 *
 * Uses minutes-based calculation for more accurate time representation.
 * Produces localized strings like "in 1 hour", "in 12 hours", "tomorrow", "in 2 days"
 * based on the time remaining until the appointment.
 *
 * @param {Date} appointmentTime - The appointment start time
 * @param {string} locale - BCP 47 locale string for translation
 * @returns {string} Human-readable time remaining (e.g., "in 1 hour", "em 1 hora")
 *
 * @example
 * ```typescript
 * const apptTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
 *
 * formatTimeUntilAppointment(apptTime, 'en-US'); // 'in less than 1 hour'
 * formatTimeUntilAppointment(apptTime, 'pt-PT'); // 'em menos de 1 hora'
 * ```
 */
export function formatTimeUntilAppointment(appointmentTime: Date, locale: string): string {
  const now = new Date();
  const totalMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);

  // Use shared normalizeLocale helper for consistent locale handling
  const normalizedLocale = normalizeLocale(locale);

  // Handle past or immediate appointments
  if (totalMinutes <= 0) {
    if (normalizedLocale === 'pt') return 'agora';
    if (normalizedLocale === 'es') return 'ahora';
    return 'now';
  }

  // Less than 60 minutes
  if (totalMinutes < 60) {
    if (normalizedLocale === 'pt') return 'em menos de 1 hora';
    if (normalizedLocale === 'es') return 'en menos de 1 hora';
    return 'in less than 1 hour';
  }

  // Calculate hours (floor to get complete hours)
  const hours = Math.floor(totalMinutes / 60);

  // Less than 24 hours - show hours
  if (hours < 24) {
    if (normalizedLocale === 'pt') {
      return hours === 1 ? 'em 1 hora' : `em ${hours} horas`;
    }
    if (normalizedLocale === 'es') {
      return hours === 1 ? 'en 1 hora' : `en ${hours} horas`;
    }
    return hours === 1 ? 'in 1 hour' : `in ${hours} hours`;
  }

  // Calculate days
  const days = Math.floor(hours / 24);

  // Tomorrow (1 day)
  if (days === 1) {
    if (normalizedLocale === 'pt') return 'amanhã';
    if (normalizedLocale === 'es') return 'mañana';
    return 'tomorrow';
  }

  // Multiple days
  if (normalizedLocale === 'pt') {
    return `em ${days} dias`;
  }
  if (normalizedLocale === 'es') {
    return `en ${days} días`;
  }
  return `in ${days} days`;
}

/**
 * Query database for appointments within a time window.
 *
 * Fetches confirmed (payment succeeded) appointments that start within
 * a specified time window. Joins with Event, User, Profile, and Schedule tables
 * to get full appointment context for notifications.
 *
 * @param {number} startOffsetMinutes - Minutes from now for window start
 * @param {number} endOffsetMinutes - Minutes from now for window end
 * @returns {Promise<Appointment[]>} Array of appointments needing reminders
 * @throws {Error} If database query fails
 *
 * @example
 * ```typescript
 * // Get appointments 24-25 hours from now (1-hour window)
 * const appointments = await getUpcomingAppointments(24 * 60, 25 * 60);
 *
 * // Get appointments 1-1.25 hours from now (15-minute window)
 * const urgentAppointments = await getUpcomingAppointments(60, 75);
 *
 * console.log(`Found ${appointments.length} appointments needing reminders`);
 * ```
 *
 * @remarks
 * - Only returns appointments with `stripePaymentStatus === 'succeeded'`
 * - Uses expert's schedule timezone if available, falls back to meeting timezone
 * - Guest locale defaults to 'en-US' (guests don't have stored locale preferences)
 */
export async function getUpcomingAppointments(
  startOffsetMinutes: number,
  endOffsetMinutes: number,
): Promise<Appointment[]> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + startOffsetMinutes * 60 * 1000);
    const windowEnd = new Date(now.getTime() + endOffsetMinutes * 60 * 1000);

    // Query for meetings within the specified time window
    // Join with SchedulesTable to get expert's actual timezone
    const upcomingMeetings = await db
      .select({
        meetingId: MeetingsTable.id,
        guestEmail: MeetingsTable.guestEmail,
        guestName: MeetingsTable.guestName,
        guestWorkosUserId: MeetingsTable.guestWorkosUserId,
        startTime: MeetingsTable.startTime,
        endTime: MeetingsTable.endTime,
        timezone: MeetingsTable.timezone,
        meetingUrl: MeetingsTable.meetingUrl,
        eventName: EventsTable.name,
        eventDuration: EventsTable.durationInMinutes,
        expertWorkosId: EventsTable.workosUserId,
        // Expert info from profile
        expertFirstName: ProfilesTable.firstName,
        expertLastName: ProfilesTable.lastName,
        // Expert country from users table
        expertCountry: UsersTable.country,
        // Expert's actual timezone from their schedule settings
        expertScheduleTimezone: SchedulesTable.timezone,
      })
      .from(MeetingsTable)
      .innerJoin(EventsTable, eq(EventsTable.id, MeetingsTable.eventId))
      .innerJoin(UsersTable, eq(UsersTable.workosUserId, EventsTable.workosUserId))
      .leftJoin(ProfilesTable, eq(ProfilesTable.workosUserId, EventsTable.workosUserId))
      .leftJoin(SchedulesTable, eq(SchedulesTable.workosUserId, EventsTable.workosUserId))
      .where(
        and(
          between(MeetingsTable.startTime, windowStart, windowEnd),
          eq(MeetingsTable.stripePaymentStatus, 'succeeded'), // Only confirmed appointments
        ),
      );

    logger.info(
      logger.fmt`Found ${upcomingMeetings.length} appointments in window (${startOffsetMinutes}-${endOffsetMinutes} min)`,
    );

    // Transform the data to match the expected interface
    const appointments: Appointment[] = upcomingMeetings.map((meeting) => {
      const expertName =
        [meeting.expertFirstName, meeting.expertLastName].filter(Boolean).join(' ') || 'Expert';

      // Use expert's schedule timezone if available, otherwise fall back to meeting timezone
      const expertTimezone = meeting.expertScheduleTimezone || meeting.timezone;

      return {
        id: meeting.meetingId,
        guestEmail: meeting.guestEmail,
        customerWorkosId: meeting.guestWorkosUserId || 'guest', // Use guest WorkOS ID if available
        expertWorkosId: meeting.expertWorkosId,
        customerName: meeting.guestName,
        expertName,
        appointmentType: meeting.eventName,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        durationMinutes: meeting.eventDuration,
        meetingUrl: meeting.meetingUrl || `https://meet.eleva.care/${meeting.meetingId}`,
        customerLocale: 'en-US', // Default for guests, could be enhanced with guest preferences
        expertLocale: getLocaleFromCountry(meeting.expertCountry),
        customerTimezone: meeting.timezone, // Patient's timezone from booking
        expertTimezone, // Expert's actual timezone from schedule settings
      };
    });

    return appointments;
  } catch (error) {
    logger.error('Error querying upcoming appointments', { error });
    throw error;
  }
}
