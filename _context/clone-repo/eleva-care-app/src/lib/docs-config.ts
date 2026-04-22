/**
 * Documentation Configuration
 *
 * Central configuration for documentation-related constants.
 * Used by help center layouts, Sentry context, and versioning.
 *
 * @module lib/docs-config
 */

/**
 * Current documentation version.
 * Used for Sentry context and cache busting.
 *
 * Update this when making significant documentation changes
 * that should be tracked separately in error monitoring.
 */
export const DOCS_VERSION = '1.0.0' as const;

/**
 * Documentation type identifier for Sentry.
 */
export const DOCS_TYPE = 'fumadocs' as const;

