/**
 * Cron job utilities and shared functionality
 *
 * This module exports utilities used by QStash-powered cron jobs
 * for appointment reminders, payment processing, and cleanup tasks.
 *
 * @module lib/cron
 *
 * @example
 * ```typescript
 * import {
 *   getUpcomingAppointments,
 *   formatDateTime,
 *   formatTimeUntilAppointment,
 *   getLocaleFromCountry,
 * } from '@/lib/cron';
 *
 * // Fetch appointments in a time window
 * const appointments = await getUpcomingAppointments(60, 75);
 *
 * // Format for display
 * const { datePart, timePart } = formatDateTime(
 *   appointment.startTime,
 *   appointment.timezone,
 *   'pt-PT',
 * );
 * ```
 */

export {
  type Appointment,
  formatDateTime,
  formatTimeUntilAppointment,
  getLocaleFromCountry,
  getUpcomingAppointments,
} from './appointment-utils';
