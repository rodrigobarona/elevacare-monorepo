/**
 * Utilities Module
 *
 * General-purpose utility functions used across the application.
 * These utilities are safe for both client and server components.
 *
 * ⚠️ Server-only utilities have been moved to `lib/utils/server/`
 * Import them directly from that folder:
 * - '@/lib/utils/server/audit'
 * - '@/lib/utils/server/scheduling'
 * - '@/lib/utils/server/service-health'
 * - '@/lib/utils/server/users'
 * - '@/lib/utils/server/server-utils'
 */

// Client-safe utilities (can be used anywhere)
export * from './formatters';
export * from './cache-keys';
export * from './customerUtils';
export * from './revalidation';

// Note: Encryption is now handled exclusively by WorkOS Vault
// Import from '@/lib/integrations/workos/vault' for encryption operations
