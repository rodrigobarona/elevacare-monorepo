/**
 * Google Calendar List Management
 *
 * Utilities for listing and managing user's Google calendars.
 * Used to let experts choose which calendars to sync (Cal.com-style).
 *
 * @see https://developers.google.com/calendar/api/v3/reference/calendarList
 */

'use server';

import { google } from 'googleapis';

import { getGoogleOAuthClient } from './oauth-tokens';

/**
 * Google Calendar List Management
 *
 * Utilities for listing and managing user's Google calendars.
 * Used to let experts choose which calendars to sync (Cal.com-style).
 *
 * @see https://developers.google.com/calendar/api/v3/reference/calendarList
 */

/**
 * Google Calendar List Management
 *
 * Utilities for listing and managing user's Google calendars.
 * Used to let experts choose which calendars to sync (Cal.com-style).
 *
 * @see https://developers.google.com/calendar/api/v3/reference/calendarList
 */

/**
 * Google Calendar List Management
 *
 * Utilities for listing and managing user's Google calendars.
 * Used to let experts choose which calendars to sync (Cal.com-style).
 *
 * @see https://developers.google.com/calendar/api/v3/reference/calendarList
 */

/**
 * Calendar information from Google Calendar API
 */
export interface GoogleCalendarInfo {
  id: string; // Calendar ID (usually email for primary calendar)
  summary: string; // Calendar name/title
  description?: string; // Calendar description
  primary?: boolean; // True if this is the user's primary calendar
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'; // User's access level
  backgroundColor?: string; // Calendar color
  foregroundColor?: string; // Text color
  selected?: boolean; // Whether calendar is selected in Google Calendar UI
  timeZone?: string; // Calendar timezone
}

/**
 * List all calendars from user's Google account
 *
 * Used to let experts choose which calendars to sync for availability checking.
 * Similar to Cal.com's calendar selection feature.
 *
 * @param workosUserId - WorkOS user ID
 * @returns Array of calendar information
 *
 * @example
 * ```typescript
 * const calendars = await listUserCalendars(expertId);
 *
 * // Show to user for selection:
 * calendars.forEach(cal => {
 *   console.log(`${cal.summary} (${cal.primary ? 'Primary' : 'Secondary'})`);
 * });
 * ```
 */
export async function listUserCalendars(workosUserId: string): Promise<GoogleCalendarInfo[]> {
  try {
    // Get authenticated Google OAuth client
    const auth = await getGoogleOAuthClient(workosUserId);

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth });

    // List all calendars
    const response = await calendar.calendarList.list({
      showHidden: false, // Don't show hidden calendars
      showDeleted: false, // Don't show deleted calendars
    });

    if (!response.data.items) {
      return [];
    }

    // Map to our interface
    return response.data.items.map((cal) => ({
      id: cal.id!,
      summary: cal.summary || 'Unnamed Calendar',
      description: cal.description ?? undefined,
      primary: cal.primary || false,
      accessRole: cal.accessRole as 'owner' | 'writer' | 'reader' | 'freeBusyReader',
      backgroundColor: cal.backgroundColor ?? undefined,
      foregroundColor: cal.foregroundColor ?? undefined,
      selected: cal.selected ?? undefined,
      timeZone: cal.timeZone ?? undefined,
    }));
  } catch (error) {
    console.error('Failed to list Google calendars:', error);
    throw new Error('Failed to retrieve calendar list. Please reconnect your Google Calendar.');
  }
}

/**
 * Get primary calendar from user's Google account
 *
 * @param workosUserId - WorkOS user ID
 * @returns Primary calendar info or null
 */
export async function getPrimaryCalendar(workosUserId: string): Promise<GoogleCalendarInfo | null> {
  try {
    const calendars = await listUserCalendars(workosUserId);
    return calendars.find((cal) => cal.primary) || null;
  } catch (error) {
    console.error('Failed to get primary calendar:', error);
    return null;
  }
}

/**
 * Get calendars where user has write access (can create events)
 *
 * @param workosUserId - WorkOS user ID
 * @returns Array of writable calendars
 */
export async function getWritableCalendars(workosUserId: string): Promise<GoogleCalendarInfo[]> {
  const calendars = await listUserCalendars(workosUserId);

  // Filter to only calendars where user can create events
  return calendars.filter((cal) => cal.accessRole === 'owner' || cal.accessRole === 'writer');
}

/**
 * Check if a specific calendar exists and user has access
 *
 * @param workosUserId - WorkOS user ID
 * @param calendarId - Calendar ID to check
 * @returns true if calendar exists and accessible
 */
export async function hasAccessToCalendar(
  workosUserId: string,
  calendarId: string,
): Promise<boolean> {
  try {
    const calendars = await listUserCalendars(workosUserId);
    return calendars.some((cal) => cal.id === calendarId);
  } catch {
    return false;
  }
}

/**
 * Validate that user can write to a specific calendar
 *
 * @param workosUserId - WorkOS user ID
 * @param calendarId - Calendar ID to check
 * @returns true if user can create events in this calendar
 */
export async function canWriteToCalendar(
  workosUserId: string,
  calendarId: string,
): Promise<boolean> {
  try {
    const calendars = await listUserCalendars(workosUserId);
    const calendar = calendars.find((cal) => cal.id === calendarId);

    if (!calendar) {
      return false;
    }

    return calendar.accessRole === 'owner' || calendar.accessRole === 'writer';
  } catch {
    return false;
  }
}
