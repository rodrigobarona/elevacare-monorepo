/**
 * Client-safe cache key generation utilities
 *
 * This module contains pure functions for generating cache keys that can be
 * safely used in both client and server components without bundling Redis.
 */

/**
 * Generate a cache key for form submission deduplication
 *
 * @param eventId - The event ID
 * @param email - The guest email (will be normalized to lowercase)
 * @param isoStart - ISO string of the start time
 * @returns A sanitized cache key string
 */
export function generateFormCacheKey(eventId: string, email: string, isoStart: string): string {
  // Normalize email to lowercase to ensure consistent cache keys regardless of casing
  const lowercasedEmail = email.toLowerCase();
  return `${eventId}-${lowercasedEmail}-${isoStart}`.replace(/[^a-zA-Z0-9-_]/g, '_');
}
