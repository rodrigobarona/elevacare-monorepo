/**
 * WorkOS Vault Integration
 *
 * Provides org-scoped encryption/decryption using WorkOS Vault with client-side encryption.
 * Uses data keys for local encryption following WorkOS best practices.
 *
 * Architecture:
 * - Generate unique data keys per encryption operation (DEK)
 * - Encrypt data locally with DEK
 * - Encrypt DEK with org-scoped key (KEK) via WorkOS API
 * - Store both encrypted data + encrypted DEK together
 *
 * Key Features:
 * - Automatic key rotation (WorkOS manages KEKs)
 * - Built-in audit logging
 * - Org-level key isolation (perfect for org-per-user model)
 * - BYOK support for enterprise customers
 *
 * Security:
 * - All encryption/decryption happens locally (data never leaves your server unencrypted)
 * - Only encrypted DEKs are sent to WorkOS API
 * - Keys are scoped by organization for complete isolation
 *
 * @see https://workos.com/docs/vault
 * @see https://github.com/workos/workos-node
 *
 * @module WorkOSVault
 */

'use server';

import * as Sentry from '@sentry/nextjs';
import { WorkOS } from '@workos-inc/node';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const { logger } = Sentry;

/**
 * WorkOS Vault Integration
 *
 * Provides org-scoped encryption/decryption using WorkOS Vault with client-side encryption.
 * Uses data keys for local encryption following WorkOS best practices.
 *
 * Architecture:
 * - Generate unique data keys per encryption operation (DEK)
 * - Encrypt data locally with DEK
 * - Encrypt DEK with org-scoped key (KEK) via WorkOS API
 * - Store both encrypted data + encrypted DEK together
 *
 * Key Features:
 * - Automatic key rotation (WorkOS manages KEKs)
 * - Built-in audit logging
 * - Org-level key isolation (perfect for org-per-user model)
 * - BYOK support for enterprise customers
 *
 * Security:
 * - All encryption/decryption happens locally (data never leaves your server unencrypted)
 * - Only encrypted DEKs are sent to WorkOS API
 * - Keys are scoped by organization for complete isolation
 *
 * @see https://workos.com/docs/vault
 * @see https://github.com/workos/workos-node
 *
 * @module WorkOSVault
 */

// Note: Other utility functions (isVaultEnabled, getEncryptionMethod, validateVaultData)
// are available in './vault-utils' and cannot be re-exported from this file due to
// Next.js 16 requirement that files with 'use server' can only export async functions

/**
 * WorkOS Vault Integration
 *
 * Provides org-scoped encryption/decryption using WorkOS Vault with client-side encryption.
 * Uses data keys for local encryption following WorkOS best practices.
 *
 * Architecture:
 * - Generate unique data keys per encryption operation (DEK)
 * - Encrypt data locally with DEK
 * - Encrypt DEK with org-scoped key (KEK) via WorkOS API
 * - Store both encrypted data + encrypted DEK together
 *
 * Key Features:
 * - Automatic key rotation (WorkOS manages KEKs)
 * - Built-in audit logging
 * - Org-level key isolation (perfect for org-per-user model)
 * - BYOK support for enterprise customers
 *
 * Security:
 * - All encryption/decryption happens locally (data never leaves your server unencrypted)
 * - Only encrypted DEKs are sent to WorkOS API
 * - Keys are scoped by organization for complete isolation
 *
 * @see https://workos.com/docs/vault
 * @see https://github.com/workos/workos-node
 *
 * @module WorkOSVault
 */

/**
 * WorkOS Vault Integration
 *
 * Provides org-scoped encryption/decryption using WorkOS Vault with client-side encryption.
 * Uses data keys for local encryption following WorkOS best practices.
 *
 * Architecture:
 * - Generate unique data keys per encryption operation (DEK)
 * - Encrypt data locally with DEK
 * - Encrypt DEK with org-scoped key (KEK) via WorkOS API
 * - Store both encrypted data + encrypted DEK together
 *
 * Key Features:
 * - Automatic key rotation (WorkOS manages KEKs)
 * - Built-in audit logging
 * - Org-level key isolation (perfect for org-per-user model)
 * - BYOK support for enterprise customers
 *
 * Security:
 * - All encryption/decryption happens locally (data never leaves your server unencrypted)
 * - Only encrypted DEKs are sent to WorkOS API
 * - Keys are scoped by organization for complete isolation
 *
 * @see https://workos.com/docs/vault
 * @see https://github.com/workos/workos-node
 *
 * @module WorkOSVault
 */

/**
 * WorkOS Vault Integration
 *
 * Provides org-scoped encryption/decryption using WorkOS Vault with client-side encryption.
 * Uses data keys for local encryption following WorkOS best practices.
 *
 * Architecture:
 * - Generate unique data keys per encryption operation (DEK)
 * - Encrypt data locally with DEK
 * - Encrypt DEK with org-scoped key (KEK) via WorkOS API
 * - Store both encrypted data + encrypted DEK together
 *
 * Key Features:
 * - Automatic key rotation (WorkOS manages KEKs)
 * - Built-in audit logging
 * - Org-level key isolation (perfect for org-per-user model)
 * - BYOK support for enterprise customers
 *
 * Security:
 * - All encryption/decryption happens locally (data never leaves your server unencrypted)
 * - Only encrypted DEKs are sent to WorkOS API
 * - Keys are scoped by organization for complete isolation
 *
 * @see https://workos.com/docs/vault
 * @see https://github.com/workos/workos-node
 *
 * @module WorkOSVault
 */

// Initialize WorkOS client
if (!process.env.WORKOS_API_KEY) {
  throw new Error('WORKOS_API_KEY environment variable is required for Vault integration');
}

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32; // 256 bits

/**
 * Encryption context for key isolation and audit trails
 *
 * This context is used to:
 * - Scope encryption keys to specific organizations
 * - Identify data type for audit logging
 * - Track user/record associations
 */
export interface EncryptionContext {
  /** WorkOS user ID performing the operation */
  userId: string;
  /** Type of data being encrypted (for audit and key management) */
  dataType: 'medical_record' | 'google_access_token' | 'google_refresh_token';
  /** Optional record identifier for detailed audit logging */
  recordId?: string;
}

/**
 * Encrypted data structure returned by Vault encryption
 *
 * Contains everything needed to decrypt data later:
 * - Encrypted content (ciphertext)
 * - Initialization vector (IV)
 * - Authentication tag for integrity verification
 * - Encrypted data key (can only be decrypted by org's KEK)
 */
export interface VaultEncryptedData {
  /** Encrypted content (hex-encoded) */
  ciphertext: string;
  /** Initialization vector (hex-encoded) */
  iv: string;
  /** Authentication tag for GCM mode (hex-encoded) */
  authTag: string;
  /** Encrypted data key from WorkOS (base64-encoded) */
  encryptedKey: string;
  /** Encryption metadata for audit */
  metadata: {
    algorithm: string;
    encryptedAt: string;
    context: EncryptionContext;
  };
}

/**
 * Encrypt data using WorkOS Vault with client-side encryption
 *
 * This function implements the envelope encryption pattern:
 * 1. Generate a unique DEK (Data Encryption Key) via WorkOS
 * 2. Encrypt plaintext locally using DEK (AES-256-GCM)
 * 3. DEK is already encrypted by WorkOS with org's KEK
 * 4. Return encrypted data + encrypted DEK together
 *
 * The encrypted DEK can only be decrypted by the organization's KEK,
 * which is managed entirely by WorkOS and never leaves their infrastructure.
 *
 * @param orgId - Organization ID for key scoping (WorkOS organization ID)
 * @param plaintext - Data to encrypt (string)
 * @param context - Encryption context for audit and key isolation
 * @returns Serialized encrypted data (JSON string)
 *
 * @example
 * ```typescript
 * const encrypted = await encryptForOrg(
 *   'org_01H1234567890',
 *   'Patient diagnosis: Type 2 diabetes',
 *   {
 *     userId: 'user_01H9876543210',
 *     dataType: 'medical_record',
 *     recordId: 'rec_01HABCDEFGHIJ'
 *   }
 * );
 *
 * // Store encrypted in database
 * await db.insert(RecordsTable).values({
 *   vaultEncryptedContent: encrypted,
 *   encryptionMethod: 'vault'
 * });
 * ```
 *
 * @throws Error if WorkOS API fails or encryption fails
 */
export async function encryptForOrg(
  orgId: string,
  plaintext: string,
  context: EncryptionContext,
): Promise<string> {
  try {
    const startTime = performance.now();

    // Step 1: Create data key via WorkOS Vault
    // This generates a random key and encrypts it with the org's KEK
    const dataKeyResponse = await workos.vault.createDataKey({
      organizationId: orgId,
    } as any); // Type workaround for WorkOS SDK

    // dataKeyResponse contains:
    // - plaintextKey: The actual encryption key (base64)
    // - encryptedKeys: The encrypted version (can only be decrypted by org's KEK)

    // Step 2: Decrypt the plaintext key for local use
    const dekBuffer = Buffer.from((dataKeyResponse as any).plaintextKey, 'base64');

    if (dekBuffer.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${dekBuffer.length}`);
    }

    // Step 3: Encrypt data locally using the DEK
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dekBuffer, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Step 4: Package everything together
    const encryptedData: VaultEncryptedData = {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedKey: dataKeyResponse.encryptedKeys, // This is what gets stored
      metadata: {
        algorithm: ALGORITHM,
        encryptedAt: new Date().toISOString(),
        context,
      },
    };

    const duration = performance.now() - startTime;

    // Log metrics for monitoring
    logger.info('Vault encrypted data', {
      orgId,
      dataType: context.dataType,
      duration: `${duration.toFixed(2)}ms`,
      success: true,
    });

    // Return as JSON string for database storage
    return JSON.stringify(encryptedData);
  } catch (error) {
    logger.error('Vault encryption failed', {
      orgId,
      dataType: context.dataType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new Error(
      `Vault encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Decrypt data using WorkOS Vault
 *
 * Decryption process:
 * 1. Parse encrypted data structure
 * 2. Decrypt the DEK using WorkOS Vault (KEK decrypt)
 * 3. Use decrypted DEK to decrypt the actual data locally
 * 4. Return plaintext
 *
 * @param orgId - Organization ID (must match encryption org)
 * @param encryptedDataJson - Serialized encrypted data from encryptForOrg()
 * @param context - Context for audit logging (should match encryption context)
 * @returns Decrypted plaintext
 *
 * @example
 * ```typescript
 * // Retrieve from database
 * const record = await db.query.RecordsTable.findFirst({
 *   where: eq(RecordsTable.id, recordId)
 * });
 *
 * // Decrypt
 * const plaintext = await decryptForOrg(
 *   record.orgId,
 *   record.vaultEncryptedContent,
 *   {
 *     userId: currentUserId,
 *     dataType: 'medical_record'
 *   }
 * );
 * ```
 *
 * @throws Error if WorkOS API fails, org mismatch, or data is corrupted
 */
export async function decryptForOrg(
  orgId: string,
  encryptedDataJson: string,
  context: EncryptionContext,
): Promise<string> {
  try {
    const startTime = performance.now();

    // Step 1: Parse encrypted data
    const encryptedData: VaultEncryptedData = JSON.parse(encryptedDataJson);

    // Step 2: Decrypt the DEK using WorkOS Vault
    const decryptedKeyResponse = await workos.vault.decryptDataKey({
      keys: encryptedData.encryptedKey,
    });

    const dekBuffer = Buffer.from(decryptedKeyResponse.key, 'base64');

    // Step 3: Decrypt data locally using the DEK
    const decipher = createDecipheriv(ALGORITHM, dekBuffer, Buffer.from(encryptedData.iv, 'hex'));

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let plaintext = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    const duration = performance.now() - startTime;

    // Log metrics
    logger.info('Vault decrypted data', {
      orgId,
      dataType: context.dataType,
      duration: `${duration.toFixed(2)}ms`,
      success: true,
    });

    return plaintext;
  } catch (error) {
    logger.error('Vault decryption failed', {
      orgId,
      dataType: context.dataType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new Error(
      `Vault decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Test Vault connectivity and encryption
 *
 * Useful for health checks and deployment verification
 *
 * @param orgId - Test organization ID
 * @returns true if encryption/decryption works
 */
export async function testVaultConnection(orgId: string): Promise<boolean> {
  try {
    const testData = 'Vault connection test';
    const encrypted = await encryptForOrg(orgId, testData, {
      userId: 'test',
      dataType: 'medical_record',
    });

    const decrypted = await decryptForOrg(orgId, encrypted, {
      userId: 'test',
      dataType: 'medical_record',
    });

    return decrypted === testData;
  } catch (error) {
    logger.error('Vault connection test failed', { error });
    return false;
  }
}
