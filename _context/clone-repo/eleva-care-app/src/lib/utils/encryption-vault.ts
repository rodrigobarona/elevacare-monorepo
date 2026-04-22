/**
 * WorkOS Vault Encryption - Simplified for Fresh Database
 *
 * Direct WorkOS Vault encryption without legacy fallback.
 * This is simplified because we're working with a fresh database in staging.
 *
 * For production migration with existing data, see:
 * @see _docs/_WorkOS Vault implemenation/workos-vault-migration-plan.md
 *
 * @module VaultEncryption
 */

'use server';

import {
  decryptForOrg,
  encryptForOrg,
  type EncryptionContext,
} from '@/lib/integrations/workos/vault';
import { validateVaultData } from '@/lib/integrations/workos/vault-utils';

/**
 * WorkOS Vault Encryption - Simplified for Fresh Database
 *
 * Direct WorkOS Vault encryption without legacy fallback.
 * This is simplified because we're working with a fresh database in staging.
 *
 * For production migration with existing data, see:
 * @see _docs/_WorkOS Vault implemenation/workos-vault-migration-plan.md
 *
 * @module VaultEncryption
 */

/**
 * WorkOS Vault Encryption - Simplified for Fresh Database
 *
 * Direct WorkOS Vault encryption without legacy fallback.
 * This is simplified because we're working with a fresh database in staging.
 *
 * For production migration with existing data, see:
 * @see _docs/_WorkOS Vault implemenation/workos-vault-migration-plan.md
 *
 * @module VaultEncryption
 */

/**
 * WorkOS Vault Encryption - Simplified for Fresh Database
 *
 * Direct WorkOS Vault encryption without legacy fallback.
 * This is simplified because we're working with a fresh database in staging.
 *
 * For production migration with existing data, see:
 * @see _docs/_WorkOS Vault implemenation/workos-vault-migration-plan.md
 *
 * @module VaultEncryption
 */

/**
 * Encrypted data structure for Vault
 */
export interface VaultEncryptedData {
  /** Encrypted ciphertext (JSON string from Vault) */
  ciphertext: string;
  /** When encryption occurred */
  encryptedAt: Date;
}

/**
 * Encrypt data using WorkOS Vault
 *
 * Simplified for fresh database - always uses Vault encryption.
 *
 * @param orgId - Organization ID for Vault encryption
 * @param plaintext - Data to encrypt
 * @param context - Encryption context for audit logging
 * @returns Encrypted data
 *
 * @example
 * ```typescript
 * const encrypted = await vaultEncrypt(
 *   userOrgId,
 *   medicalNotes,
 *   {
 *     userId: currentUserId,
 *     dataType: 'medical_record',
 *     recordId: recordId
 *   }
 * );
 *
 * // Store in database
 * await db.insert(RecordsTable).values({
 *   vaultEncryptedContent: encrypted.ciphertext,
 *   encryptionMethod: 'vault'
 * });
 * ```
 */
export async function vaultEncrypt(
  orgId: string,
  plaintext: string,
  context: EncryptionContext,
): Promise<VaultEncryptedData> {
  const ciphertext = await encryptForOrg(orgId, plaintext, context);
  return {
    ciphertext,
    encryptedAt: new Date(),
  };
}

/**
 * Decrypt data using WorkOS Vault
 *
 * Simplified for fresh database - always uses Vault decryption.
 *
 * @param orgId - Organization ID
 * @param ciphertext - Encrypted data from Vault
 * @param context - Decryption context for audit logging
 * @returns Decrypted plaintext
 *
 * @example
 * ```typescript
 * const record = await db.query.RecordsTable.findFirst({
 *   where: eq(RecordsTable.id, recordId)
 * });
 *
 * const plaintext = await vaultDecrypt(
 *   record.orgId,
 *   record.vaultEncryptedContent,
 *   {
 *     userId: currentUserId,
 *     dataType: 'medical_record'
 *   }
 * );
 * ```
 */
export async function vaultDecrypt(
  orgId: string,
  ciphertext: string,
  context: EncryptionContext,
): Promise<string> {
  return await decryptForOrg(orgId, ciphertext, context);
}

// Note: validateVaultData has been moved to @/lib/integrations/workos/vault-utils
// This complies with Next.js 16 requirement that files with 'use server' can only export async functions
export { validateVaultData };
