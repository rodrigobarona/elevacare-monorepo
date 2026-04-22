/**
 * Google Calendar Scope Validation
 *
 * Utilities for validating Google Calendar API scopes
 * Based on Google Calendar API documentation:
 * @see https://developers.google.com/workspace/calendar/api/auth
 */

'use server';

import type { GoogleOAuthTokens } from './oauth-tokens';

/**
 * Check if tokens have required Google Calendar scopes
 *
 * Required scopes for Eleva:
 * - `calendar.events` - Create/edit/delete events
 * - `calendar.calendarlist.readonly` - List calendars (let expert choose)
 *
 * Also accepts full `calendar` scope (broader, but valid)
 *
 * @param tokens - Google OAuth tokens
 * @returns true if calendar scopes are present
 *
 * @example
 * ```typescript
 * const tokens = await getStoredGoogleTokens(userId);
 * if (!tokens || !hasCalendarScopes(tokens)) {
 *   throw new Error('Google Calendar not connected');
 * }
 * ```
 */
export function hasCalendarScopes(tokens: GoogleOAuthTokens | null): boolean {
  if (!tokens?.scope) {
    return false;
  }

  // Check for required narrow scopes (preferred)
  const hasEvents = tokens.scope.includes('https://www.googleapis.com/auth/calendar.events');
  const hasCalendarList = tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist');

  // Check for full calendar scope (broader, but still valid)
  const hasFull = tokens.scope.includes('https://www.googleapis.com/auth/calendar');

  // Either narrow scopes OR full scope
  return (hasEvents && hasCalendarList) || hasFull;
}

/**
 * Check if tokens have calendar list access (to list user's calendars)
 *
 * @param tokens - Google OAuth tokens
 * @returns true if can list calendars
 */
export function hasCalendarListScope(tokens: GoogleOAuthTokens | null): boolean {
  if (!tokens?.scope) {
    return false;
  }

  return (
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist') ||
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly') ||
    tokens.scope.includes('https://www.googleapis.com/auth/calendar') // Full scope includes list
  );
}

/**
 * Check if tokens have read-only calendar scopes
 *
 * @param tokens - Google OAuth tokens
 * @returns true if read-only calendar scopes are present
 */
export function hasReadOnlyCalendarScopes(tokens: GoogleOAuthTokens | null): boolean {
  if (!tokens?.scope) {
    return false;
  }

  return (
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.readonly') ||
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.events.readonly')
  );
}

/**
 * Get the level of calendar access based on scopes
 *
 * @param tokens - Google OAuth tokens
 * @returns Access level: 'full' | 'events_with_list' | 'events' | 'readonly' | 'none'
 */
export function getCalendarAccessLevel(
  tokens: GoogleOAuthTokens | null,
): 'full' | 'events_with_list' | 'events' | 'readonly' | 'none' {
  if (!tokens?.scope) {
    return 'none';
  }

  // Full calendar access (can manage calendars, share, delete)
  if (tokens.scope.includes('https://www.googleapis.com/auth/calendar')) {
    return 'full';
  }

  // Events + calendar list access (recommended for Eleva)
  const hasEvents = tokens.scope.includes('https://www.googleapis.com/auth/calendar.events');
  const hasCalendarList =
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist') ||
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly');

  if (hasEvents && hasCalendarList) {
    return 'events_with_list';
  }

  // Events-only access (can create/read/update/delete events, but can't list calendars)
  if (hasEvents) {
    return 'events';
  }

  // Read-only access
  if (
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.readonly') ||
    tokens.scope.includes('https://www.googleapis.com/auth/calendar.events.readonly')
  ) {
    return 'readonly';
  }

  return 'none';
}

/**
 * Validate that user has required calendar permissions
 *
 * Throws error if scopes are missing
 *
 * @param tokens - Google OAuth tokens
 * @param requireWrite - Whether write access is required (default: true)
 * @throws Error if required scopes are missing
 *
 * @example
 * ```typescript
 * const tokens = await getStoredGoogleTokens(expertId);
 * validateCalendarScopes(tokens); // Throws if missing write access
 * validateCalendarScopes(tokens, false); // OK with read-only
 * ```
 */
export function validateCalendarScopes(
  tokens: GoogleOAuthTokens | null,
  requireWrite: boolean = true,
): asserts tokens is GoogleOAuthTokens {
  if (!tokens) {
    throw new Error(
      'Google Calendar not connected. Please connect your Google Calendar in settings.',
    );
  }

  if (requireWrite && !hasCalendarScopes(tokens)) {
    throw new Error(
      'Missing required Google Calendar permissions. Please reconnect your Google Calendar with full access.',
    );
  }

  if (!requireWrite && !hasReadOnlyCalendarScopes(tokens) && !hasCalendarScopes(tokens)) {
    throw new Error('Missing Google Calendar read permissions. Please connect your Google Calendar.');
  }
}

/**
 * Format scopes for display to users
 *
 * @param tokens - Google OAuth tokens
 * @returns Human-readable scope descriptions
 */
export function formatScopesForDisplay(tokens: GoogleOAuthTokens | null): string[] {
  if (!tokens?.scope) {
    return ['No calendar access'];
  }

  const scopes: string[] = [];

  if (tokens.scope.includes('https://www.googleapis.com/auth/calendar')) {
    scopes.push('Full calendar access (view, edit, share, delete)');
  } else {
    if (tokens.scope.includes('https://www.googleapis.com/auth/calendar.events')) {
      scopes.push('Create, edit, and delete events');
    }
    if (
      tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist') ||
      tokens.scope.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly')
    ) {
      scopes.push('View list of calendars');
    }
    if (tokens.scope.includes('https://www.googleapis.com/auth/calendar.readonly')) {
      scopes.push('View calendars (read-only)');
    }
    if (tokens.scope.includes('https://www.googleapis.com/auth/calendar.events.readonly')) {
      scopes.push('View events (read-only)');
    }
  }

  return scopes.length > 0 ? scopes : ['No calendar access'];
}

