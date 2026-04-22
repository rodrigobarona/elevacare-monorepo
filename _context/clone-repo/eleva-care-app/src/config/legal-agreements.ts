/**
 * Legal Agreements Configuration
 *
 * Centralized management of legal agreement versions for audit trail compliance.
 * This file tracks versions of legal agreements that require explicit user acceptance.
 *
 * When updating agreements:
 * 1. Update the version string (use semantic versioning or date-based)
 * 2. Update the effectiveDate to when the new version takes effect
 * 3. Consider if existing users need to re-accept (set requiresReacceptance)
 */

/**
 * Expert Agreement Version Configuration
 *
 * The expert agreement is required for experts to publish their profiles
 * and offer services on the Eleva.care platform.
 *
 * Note: Variable name kept as PRACTITIONER_AGREEMENT_CONFIG for backward
 * compatibility with database fields and existing code references.
 */
export const PRACTITIONER_AGREEMENT_CONFIG = {
  /**
   * Current version of the expert agreement
   * Format: Use semantic versioning (e.g., "1.0", "1.1", "2.0")
   * or date-based versioning (e.g., "2024-10-01")
   */
  version: '1.0',

  /**
   * When this version became effective
   */
  effectiveDate: new Date('2024-10-01'),

  /**
   * Path to the agreement document
   */
  documentPath: '/legal/expert-agreement',

  /**
   * Whether existing users who accepted a previous version
   * need to re-accept this version to continue using the platform
   */
  requiresReacceptance: false,

  /**
   * Minimum version required (if requiresReacceptance is true)
   * Users with older versions will be prompted to accept the new version
   */
  minimumRequiredVersion: '1.0',
} as const;

/**
 * Terms of Service Version Configuration
 *
 * General terms of service for all platform users
 */
export const TERMS_OF_SERVICE_CONFIG = {
  version: '1.0',
  effectiveDate: new Date('2024-10-01'),
  documentPath: '/legal/terms',
  requiresReacceptance: false,
  minimumRequiredVersion: '1.0',
} as const;

/**
 * Privacy Policy Version Configuration
 *
 * Privacy policy for data processing transparency
 */
export const PRIVACY_POLICY_CONFIG = {
  version: '1.0',
  effectiveDate: new Date('2024-10-01'),
  documentPath: '/legal/privacy',
  requiresReacceptance: false,
  minimumRequiredVersion: '1.0',
} as const;

/**
 * Data Processing Agreement Version Configuration
 *
 * DPA for GDPR/LGPD compliance
 */
export const DPA_CONFIG = {
  version: '1.0',
  effectiveDate: new Date('2024-10-01'),
  documentPath: '/trust/dpa',
  requiresReacceptance: false,
  minimumRequiredVersion: '1.0',
} as const;

/**
 * Helper function to check if a user's agreement version is current
 */
export function isAgreementVersionCurrent(
  userVersion: string | null | undefined,
  config: typeof PRACTITIONER_AGREEMENT_CONFIG,
): boolean {
  if (!userVersion) return false;
  if (!config.requiresReacceptance) return true;
  return userVersion >= config.minimumRequiredVersion;
}

/**
 * Helper function to get agreement metadata for audit logging
 */
export function getAgreementMetadata(config: typeof PRACTITIONER_AGREEMENT_CONFIG) {
  return {
    version: config.version,
    effectiveDate: config.effectiveDate.toISOString(),
    documentPath: config.documentPath,
  };
}

/**
 * Export all configs for easy import
 * Note: Key names preserved for backward compatibility
 */
export const LEGAL_AGREEMENT_CONFIGS = {
  practitionerAgreement: PRACTITIONER_AGREEMENT_CONFIG, // Expert Agreement
  termsOfService: TERMS_OF_SERVICE_CONFIG,
  privacyPolicy: PRIVACY_POLICY_CONFIG,
  dpa: DPA_CONFIG,
} as const;
