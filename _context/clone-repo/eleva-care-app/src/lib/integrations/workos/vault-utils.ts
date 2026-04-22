/**
 * WorkOS Vault Utility Functions
 *
 * Synchronous utility functions for Vault validation.
 * Separated from vault.ts to comply with Next.js 16 'use server' requirements.
 *
 * Note: This file does NOT have 'use server' because it contains synchronous functions.
 * In Next.js 16, files with 'use server' can only export async functions.
 *
 * @module WorkOSVaultUtils
 */

/**
 * Validate that an organization ID is properly formatted
 *
 * WorkOS organization IDs start with 'org_'
 *
 * @param orgId - Organization ID to validate
 * @returns true if valid
 * @throws Error if invalid
 */
export function validateOrgId(orgId: string): boolean {
  if (!orgId || typeof orgId !== 'string') {
    throw new Error('Organization ID is required');
  }

  if (!orgId.startsWith('org_')) {
    throw new Error(`Invalid WorkOS organization ID format: ${orgId}`);
  }

  return true;
}

/**
 * Validate WorkOS Vault encrypted data structure
 *
 * Performs basic validation to ensure the encrypted data has the expected format.
 * Does not validate the actual encryption - only checks structure.
 *
 * @param encryptedData - The encrypted data JSON string to validate
 * @returns true if data appears valid (basic structure check)
 */
export function validateVaultData(encryptedData: string): boolean {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return false;
  }

  try {
    const parsed = JSON.parse(encryptedData);

    // Check for required WorkOS Vault format fields
    return !!(
      parsed.ciphertext &&
      parsed.iv &&
      parsed.authTag &&
      parsed.encryptedKey &&
      parsed.metadata
    );
  } catch {
    return false;
  }
}
