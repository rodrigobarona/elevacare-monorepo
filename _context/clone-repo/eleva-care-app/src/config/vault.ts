/**
 * WorkOS Vault Configuration
 *
 * Configuration for WorkOS Vault encryption integration.
 *
 * Environment Variables:
 * - WORKOS_API_KEY: WorkOS API key (required, already configured for AuthKit)
 * - WORKOS_VAULT_ENABLED: Feature flag to enable Vault encryption ('true' | 'false')
 * - VAULT_MIGRATION_ENABLED: Enable background migration jobs ('true' | 'false')
 *
 * @see src/lib/integrations/workos/vault.ts
 * @module VaultConfig
 */

/**
 * Feature flags for Vault encryption
 */
export const VaultConfig = {
  /**
   * Enable WorkOS Vault encryption for new records
   *
   * When true:
   * - New records encrypted with Vault (dual-write with legacy)
   * - Reads try Vault first, fallback to legacy
   *
   * When false:
   * - All operations use legacy AES-256-GCM
   *
   * Default: false (must explicitly enable)
   */
  ENABLED: process.env.WORKOS_VAULT_ENABLED === 'true',

  /**
   * Enable batch migration of existing records
   *
   * When true:
   * - Migration scripts can run
   * - Background jobs will migrate old records
   *
   * Default: false (must explicitly enable)
   */
  MIGRATION_ENABLED: process.env.VAULT_MIGRATION_ENABLED === 'true',

  /**
   * WorkOS API Key (inherited from AuthKit configuration)
   */
  API_KEY: process.env.WORKOS_API_KEY,

  /**
   * Migration batch size (number of records to migrate at once)
   *
   * Lower values = safer but slower
   * Higher values = faster but more memory usage
   */
  MIGRATION_BATCH_SIZE: parseInt(process.env.VAULT_MIGRATION_BATCH_SIZE || '100', 10),

  /**
   * Enable verbose logging for Vault operations
   *
   * Useful for debugging but can be noisy in production
   */
  VERBOSE_LOGGING: process.env.VAULT_VERBOSE_LOGGING === 'true',
} as const;

/**
 * Validate Vault configuration
 *
 * @throws Error if configuration is invalid
 */
export function validateVaultConfig(): void {
  if (VaultConfig.ENABLED && !VaultConfig.API_KEY) {
    throw new Error(
      'WorkOS Vault is enabled but WORKOS_API_KEY is not configured. ' +
        'Set WORKOS_API_KEY in your environment variables.',
    );
  }

  if (VaultConfig.MIGRATION_ENABLED && !VaultConfig.ENABLED) {
    console.warn(
      '[Vault Config] WARNING: VAULT_MIGRATION_ENABLED is true but WORKOS_VAULT_ENABLED is false. ' +
        'Migration will not work until Vault is enabled.',
    );
  }

  if (VaultConfig.MIGRATION_BATCH_SIZE < 1 || VaultConfig.MIGRATION_BATCH_SIZE > 1000) {
    throw new Error(
      `Invalid VAULT_MIGRATION_BATCH_SIZE: ${VaultConfig.MIGRATION_BATCH_SIZE}. Must be between 1 and 1000.`,
    );
  }
}

/**
 * Get current Vault configuration status
 *
 * @returns Configuration status summary
 */
export function getVaultStatus() {
  return {
    enabled: VaultConfig.ENABLED,
    migrationEnabled: VaultConfig.MIGRATION_ENABLED,
    apiKeyConfigured: !!VaultConfig.API_KEY,
    batchSize: VaultConfig.MIGRATION_BATCH_SIZE,
    verboseLogging: VaultConfig.VERBOSE_LOGGING,
  };
}

/**
 * Log Vault configuration on startup
 */
export function logVaultConfig(): void {
  const status = getVaultStatus();

  console.log('\n' + '='.repeat(60));
  console.log('WorkOS Vault Configuration');
  console.log('='.repeat(60));
  console.log(`Vault Enabled:          ${status.enabled ? '✅ YES' : '❌ NO'}`);
  console.log(`Migration Enabled:      ${status.migrationEnabled ? '✅ YES' : '❌ NO'}`);
  console.log(`API Key Configured:     ${status.apiKeyConfigured ? '✅ YES' : '❌ NO'}`);
  console.log(`Migration Batch Size:   ${status.batchSize}`);
  console.log(`Verbose Logging:        ${status.verboseLogging ? 'ON' : 'OFF'}`);
  console.log('='.repeat(60) + '\n');

  if (status.enabled && !status.apiKeyConfigured) {
    console.error(
      '❌ ERROR: WorkOS Vault is enabled but API key is not configured!\n' +
        '   Please set WORKOS_API_KEY in your environment variables.\n',
    );
  }
}

