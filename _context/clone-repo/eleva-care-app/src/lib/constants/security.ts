/**
 * Security Constants and Utilities
 *
 * Centralized security-related constants and helper functions used for
 * detecting and logging security-sensitive errors across the application.
 */

/**
 * Keywords that indicate a security-sensitive error.
 * Used to trigger elevated audit logging for potential security incidents.
 *
 * Categories:
 * - Authentication: unauthorized, Unauthorized
 * - Authorization: permission, access denied, forbidden
 * - Encryption: encrypt, decrypt, Vault
 */
export const SECURITY_ERROR_KEYWORDS = [
  // Authentication errors
  'unauthorized',
  'Unauthorized',
  // Authorization errors
  'permission',
  'access denied',
  'forbidden',
  // Encryption/Vault errors
  'encrypt',
  'decrypt',
  'Vault',
] as const;

export type SecurityErrorKeyword = (typeof SECURITY_ERROR_KEYWORDS)[number];

/**
 * Detect if an error is security-sensitive based on its message.
 * Used to trigger elevated audit logging for potential security incidents.
 *
 * @param error - The error to check (can be any type)
 * @returns true if the error message contains any security-sensitive keywords
 *
 * @example
 * ```ts
 * try {
 *   await sensitiveOperation();
 * } catch (error) {
 *   if (isSecuritySensitiveError(error)) {
 *     // Trigger security alert
 *   }
 * }
 * ```
 */
export function isSecuritySensitiveError(error: unknown): boolean {
  return (
    error instanceof Error &&
    SECURITY_ERROR_KEYWORDS.some((keyword) => error.message.includes(keyword))
  );
}

/**
 * Log a security-sensitive error to console with structured audit data.
 * Used when database audit logging may not be available (e.g., auth context missing).
 *
 * @param error - The error that occurred
 * @param action - The action being performed (e.g., 'MEDICAL_RECORD_CREATED')
 * @param resourceType - The type of resource (e.g., 'medical_record')
 * @param resourceId - The ID of the resource being accessed
 *
 * @example
 * ```ts
 * } catch (error) {
 *   console.error('Error creating record:', error);
 *   logSecurityError(error, 'MEDICAL_RECORD_CREATED', 'medical_record', recordId);
 *   return NextResponse.json({ error: 'Failed' }, { status: 500 });
 * }
 * ```
 */
export function logSecurityError(
  error: unknown,
  action: string,
  resourceType: string,
  resourceId: string,
): void {
  const isSecuritySensitive = isSecuritySensitiveError(error);
  console.error(
    '[AUDIT - ERROR]',
    JSON.stringify({
      action: isSecuritySensitive ? 'SECURITY_ALERT_TRIGGERED' : action,
      status: 'failed',
      resourceType,
      resourceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      isSecuritySensitive,
      timestamp: new Date().toISOString(),
    }),
  );
}
