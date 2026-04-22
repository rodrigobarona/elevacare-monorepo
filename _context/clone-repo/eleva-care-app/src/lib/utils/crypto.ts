/**
 * Runtime-aware HMAC cryptographic utilities
 *
 * This module provides HMAC operations that work in both Bun and Node.js runtimes.
 * - Local development uses Bun.CryptoHasher for native performance
 * - Vercel production uses node:crypto for full compatibility
 *
 * @see {@link _docs/03-infrastructure/BUN-RUNTIME-MIGRATION.md} for architecture details
 */

import { createHmac } from 'node:crypto';

/**
 * Check if running in Bun runtime
 */
const isBunRuntime = typeof Bun !== 'undefined';

/**
 * Generate an HMAC-SHA256 signature
 *
 * Uses Bun.CryptoHasher when available (local dev), falls back to node:crypto (Vercel).
 *
 * @param key - The secret key for HMAC
 * @param data - The data to sign
 * @returns The hex-encoded HMAC signature
 *
 * @example
 * ```typescript
 * const signature = createHmacSha256('secret-key', 'data-to-sign');
 * // Returns: 'a1b2c3...' (64 character hex string)
 * ```
 */
export function createHmacSha256(key: string, data: string): string {
  if (isBunRuntime) {
    // Use Bun's native CryptoHasher for better performance
    const hasher = new Bun.CryptoHasher('sha256', key);
    hasher.update(data);
    return hasher.digest('hex');
  }

  // Fall back to Node.js crypto module
  return createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Generate a verification token with timestamp and HMAC signature
 *
 * Format: `{timestamp}.{signature}`
 *
 * @param key - The secret key for HMAC
 * @returns The verification token string
 *
 * @example
 * ```typescript
 * const token = generateVerificationToken('secret-key');
 * // Returns: '1702483200.a1b2c3...'
 * ```
 */
export function generateVerificationToken(key: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmacSha256(key, timestamp);
  return `${timestamp}.${signature}`;
}

/**
 * Get current runtime information
 *
 * @returns Object containing runtime name and version
 */
export function getRuntimeInfo(): { runtime: string; version: string } {
  if (isBunRuntime) {
    return {
      runtime: 'bun',
      version: Bun.version,
    };
  }
  return {
    runtime: 'node',
    version: process.version,
  };
}

export { isBunRuntime };

