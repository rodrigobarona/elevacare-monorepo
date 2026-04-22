/**
 * Username Utilities
 *
 * Helper functions for username validation, generation, and management.
 * Used for public profile URLs (/[username]) and user identification.
 *
 * Format Rules:
 * - Lowercase only
 * - Alphanumeric + underscore/dash
 * - 3-30 characters
 * - Cannot start/end with dash or underscore
 * - No consecutive dashes or underscores
 * - Cannot be a reserved route
 *
 * @see lib/constants/routes.ts for reserved usernames
 */
import { isReservedRoute } from '@/lib/constants/routes';

/**
 * Username validation regex
 * - Must start with alphanumeric
 * - Can contain alphanumeric, dash, underscore
 * - Must end with alphanumeric
 * - 3-30 characters total
 */
const USERNAME_REGEX = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

/**
 * Minimum and maximum username length
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Validation result for username checks
 */
export type UsernameValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validate a username against all rules
 *
 * @param username - The username to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateUsername('dr-maria');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateUsername(username: string): UsernameValidationResult {
  // Check if empty
  if (!username || username.trim() === '') {
    return {
      valid: false,
      error: 'Username is required',
    };
  }

  // Check length
  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  // Check format (lowercase, alphanumeric + dash/underscore)
  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error:
        'Username must be lowercase, start and end with a letter or number, and can only contain letters, numbers, dashes, and underscores',
    };
  }

  // Check for consecutive dashes or underscores
  if (
    username.includes('--') ||
    username.includes('__') ||
    username.includes('-_') ||
    username.includes('_-')
  ) {
    return {
      valid: false,
      error: 'Username cannot contain consecutive dashes or underscores',
    };
  }

  // Check if reserved
  if (isReservedRoute(username)) {
    return {
      valid: false,
      error: 'This username is reserved and cannot be used',
    };
  }

  return { valid: true };
}

/**
 * Generate a username from a name or email
 *
 * @param input - Name (e.g., "Dr. Maria Silva") or email (e.g., "maria@example.com")
 * @returns A valid username suggestion (e.g., "dr-maria-silva" or "maria")
 *
 * @example
 * ```typescript
 * const username = generateUsernameFromInput('Dr. Maria Silva');
 * // Returns: 'dr-maria-silva'
 *
 * const username2 = generateUsernameFromInput('john.doe@example.com');
 * // Returns: 'john-doe'
 * ```
 */
export function generateUsernameFromInput(input: string): string {
  // Extract name part from email if it's an email
  let base = input;
  if (input.includes('@')) {
    base = input.split('@')[0];
  }

  // Convert to lowercase and replace special chars with dash
  base = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
    .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
    .replace(/-+/g, '-'); // Replace multiple dashes with single dash

  // Ensure it meets length requirements
  if (base.length < USERNAME_MIN_LENGTH) {
    // If too short, append random suffix
    base = `${base}${Math.random().toString(36).substring(2, 5)}`;
  }

  if (base.length > USERNAME_MAX_LENGTH) {
    // If too long, truncate
    base = base.substring(0, USERNAME_MAX_LENGTH);
    // Ensure doesn't end with dash
    if (base.endsWith('-')) {
      base = base.substring(0, base.length - 1);
    }
  }

  // If it's a reserved route, append suffix
  if (isReservedRoute(base)) {
    base = `${base}-user`;
  }

  return base;
}

/**
 * Suggest alternative usernames if the desired one is taken
 *
 * @param baseUsername - The base username to generate alternatives for
 * @param count - Number of suggestions to generate (default: 5)
 * @returns Array of alternative username suggestions
 *
 * @example
 * ```typescript
 * const alternatives = suggestAlternativeUsernames('maria', 3);
 * // Returns: ['maria1', 'maria2', 'maria3']
 * // or: ['maria-123', 'maria-456', 'maria-789']
 * ```
 */
export function suggestAlternativeUsernames(baseUsername: string, count: number = 5): string[] {
  const suggestions: string[] = [];

  for (let i = 0; i < count; i++) {
    // Try different strategies
    if (i === 0) {
      // Add current year
      suggestions.push(`${baseUsername}${new Date().getFullYear()}`);
    } else if (i === 1) {
      // Add sequential number
      suggestions.push(`${baseUsername}${i}`);
    } else {
      // Add random number
      const random = Math.floor(Math.random() * 999) + 1;
      suggestions.push(`${baseUsername}${random}`);
    }
  }

  // Filter out any that exceed max length
  return suggestions
    .map((s) => (s.length > USERNAME_MAX_LENGTH ? s.substring(0, USERNAME_MAX_LENGTH) : s))
    .filter((s) => validateUsername(s).valid);
}

/**
 * Sanitize a username input (convert to lowercase, basic cleanup)
 *
 * @param input - The raw username input
 * @returns Sanitized username
 *
 * @example
 * ```typescript
 * const clean = sanitizeUsernameInput('Dr. Maria!');
 * // Returns: 'dr-maria'
 * ```
 */
export function sanitizeUsernameInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '') // Remove invalid chars
    .replace(/^[-_]+|[-_]+$/g, '') // Remove leading/trailing dashes/underscores
    .replace(/[-_]{2,}/g, '-'); // Replace multiple dashes/underscores with single dash
}

/**
 * Check if a string looks like a valid username format (client-side quick check)
 *
 * @param input - The string to check
 * @returns True if it looks like a valid username format
 */
export function isValidUsernameFormat(input: string): boolean {
  return (
    USERNAME_REGEX.test(input) &&
    input.length >= USERNAME_MIN_LENGTH &&
    input.length <= USERNAME_MAX_LENGTH
  );
}
