import type { AuditEventAction, AuditResourceType } from '@/drizzle/schema';
import { AuditLogsTable } from '@/drizzle/schema';
import { getOrgScopedDb } from '@/lib/integrations/neon/rls-client';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { headers } from 'next/headers';

const { logger } = Sentry;

/**
 * Unified Audit Logging System
 *
 * Compliance: HIPAA, GDPR, SOC2
 * - Append-only logs (immutable)
 * - RLS ensures org-scoped access
 * - Automatic user/IP/userAgent capture
 *
 * @example
 * ```typescript
 * // Log with automatic context extraction
 * await logAuditEvent('MEDICAL_RECORD_VIEWED', 'medical_record', 'rec_123');
 *
 * // Log with changes
 * await logAuditEvent(
 *   'APPOINTMENT_UPDATED',
 *   'appointment',
 *   'apt_456',
 *   { oldValues: { status: 'pending' }, newValues: { status: 'confirmed' } }
 * );
 *
 * // Log with metadata
 * await logAuditEvent(
 *   'PAYMENT_COMPLETED',
 *   'payment',
 *   'pay_789',
 *   undefined,
 *   { amount: 5000, currency: 'EUR' }
 * );
 * ```
 */

// Re-export types for convenience
export type { AuditEventAction, AuditResourceType } from '@/drizzle/schema';

/**
 * Get request context (IP address and user agent)
 * Automatically extracts from Next.js headers
 */
async function getRequestContext(): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  const headersList = await headers();

  return {
    ipAddress:
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      'unknown',
    userAgent: headersList.get('user-agent') || 'unknown',
  };
}

/**
 * Keys that contain PII and should be redacted from audit logs.
 * These keys are matched case-insensitively as substrings.
 */
const SENSITIVE_AUDIT_KEYS = [
  'email',
  'guestEmail',
  'expertEmail',
  'guestNotes',
  'vaultEncryptedContent',
  'vaultEncryptedMetadata',
  'password',
  'phone',
  'address',
  'ssn',
  'creditCard',
];

/**
 * Redacts sensitive PII fields from audit log values.
 * Replaces matching field values with '[REDACTED]' to prevent PII storage.
 *
 * @param values - Object containing potential PII fields
 * @returns Redacted copy of the object, or null if input is null/undefined
 *
 * @example
 * ```typescript
 * redactSensitiveFields({ email: 'test@example.com', status: 'active' });
 * // Returns: { email: '[REDACTED]', status: 'active' }
 * ```
 */
export function redactSensitiveFields(
  values: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!values) return null;
  const redacted = { ...values };
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_AUDIT_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

/**
 * Anonymizes an IP address for GDPR compliance.
 * - IPv4: Zeros the last octet (192.168.1.100 → 192.168.1.0)
 * - IPv6: Truncates to first 4 segments
 *
 * @param ip - The IP address to anonymize
 * @returns Anonymized IP address
 *
 * @example
 * ```typescript
 * anonymizeIpAddress('192.168.1.100'); // '192.168.1.0'
 * anonymizeIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334'); // '2001:0db8:85a3:0000::'
 * ```
 */
export function anonymizeIpAddress(ip: string): string {
  if (ip === 'unknown') return ip;
  // IPv4: zero last octet (192.168.1.100 -> 192.168.1.0)
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  }
  // IPv6: truncate to first 4 segments
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 4).join(':') + '::';
  }
  return ip;
}

/**
 * Log audit event with automatic context extraction
 *
 * Automatically extracts from session/headers:
 * - workosUserId from JWT
 * - orgId from session
 * - ipAddress from request headers
 * - userAgent from request headers
 *
 * @param action - What happened (e.g., 'MEDICAL_RECORD_VIEWED')
 * @param resourceType - What type of resource (e.g., 'medical_record')
 * @param resourceId - ID of the affected resource
 * @param changes - Optional: old and new values for updates
 * @param metadata - Optional: additional context
 */
export async function logAuditEvent(
  action: AuditEventAction,
  resourceType: AuditResourceType,
  resourceId: string,
  changes?: {
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // Get session (includes user.id and organizationId)
    const { user, organizationId } = await withAuth({ ensureSignedIn: true });

    // Get request context
    const { ipAddress, userAgent } = await getRequestContext();

    // Get RLS-enabled database
    const db = await getOrgScopedDb();

    // Insert audit log - RLS automatically scopes by org!
    // orgId is nullable for actions performed outside an organization context
    // PII fields are redacted and IP addresses are anonymized for GDPR compliance
    await db.insert(AuditLogsTable).values({
      workosUserId: user.id,
      orgId: organizationId ?? null,
      action,
      resourceType,
      resourceId,
      oldValues: redactSensitiveFields(changes?.oldValues),
      newValues: redactSensitiveFields(changes?.newValues),
      ipAddress: anonymizeIpAddress(ipAddress),
      userAgent,
      metadata: metadata || null,
    });
  } catch (error) {
    // 🚨 CRITICAL: Audit log failures must be captured but not block user actions
    logger.error('AUDIT FAILURE - CRITICAL', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      auditData: {
        action,
        resourceType,
        resourceId,
        timestamp: new Date().toISOString(),
      },
    });
    Sentry.captureException(error, {
      tags: { context: 'audit-log' },
      extra: { action, resourceType, resourceId },
    });

    // DO NOT throw - never block user actions due to audit failures
  }
}

/**
 * Query audit logs for a specific organization
 *
 * RLS automatically filters by user's org membership.
 *
 * @param filters - Query filters
 * @returns Array of audit log entries
 */
export async function getAuditLogs(filters?: {
  startDate?: Date;
  endDate?: Date;
  actions?: AuditEventAction[];
  resourceTypes?: AuditResourceType[];
  resourceId?: string;
  workosUserId?: string;
  limit?: number;
}) {
  await withAuth({ ensureSignedIn: true }); // Verify authentication
  const db = await getOrgScopedDb();

  // Build query with filters
  let query = db.select().from(AuditLogsTable);

  // RLS automatically filters by org - no need to add WHERE clause!

  // Apply additional filters
  if (filters?.startDate) {
    query = query.where(gte(AuditLogsTable.createdAt, filters.startDate)) as typeof query;
  }

  if (filters?.endDate) {
    query = query.where(lte(AuditLogsTable.createdAt, filters.endDate)) as typeof query;
  }

  if (filters?.resourceId) {
    query = query.where(eq(AuditLogsTable.resourceId, filters.resourceId)) as typeof query;
  }

  if (filters?.workosUserId) {
    query = query.where(eq(AuditLogsTable.workosUserId, filters.workosUserId)) as typeof query;
  }

  if (filters?.actions && filters.actions.length > 0) {
    query = query.where(inArray(AuditLogsTable.action, filters.actions)) as typeof query;
  }

  if (filters?.resourceTypes && filters.resourceTypes.length > 0) {
    query = query.where(
      inArray(AuditLogsTable.resourceType, filters.resourceTypes),
    ) as typeof query;
  }

  // Order by most recent first
  query = query.orderBy(desc(AuditLogsTable.createdAt)) as typeof query;

  // Limit results
  if (filters?.limit) {
    query = query.limit(filters.limit) as typeof query;
  }

  return await query;
}

/**
 * Export audit logs for compliance reporting
 *
 * Useful for HIPAA audits, GDPR data requests, and compliance reporting.
 *
 * @param params - Export parameters
 * @returns Export data and logs
 */
export async function exportAuditLogs(params: {
  startDate: Date;
  endDate: Date;
  actions?: AuditEventAction[];
  resourceTypes?: AuditResourceType[];
  reason?: string;
  format?: 'json' | 'csv';
}) {
  // Fetch audit logs with filters
  const logs = await getAuditLogs({
    startDate: params.startDate,
    endDate: params.endDate,
    actions: params.actions,
    resourceTypes: params.resourceTypes,
  });

  return {
    logs,
    format: params.format || 'json',
    reason: params.reason || 'Manual export',
    recordCount: logs.length,
  };
}

/**
 * Get audit logs for a specific resource
 *
 * Useful for showing "Activity" or "History" on a record.
 *
 * @param resourceType - Type of resource
 * @param resourceId - ID of resource
 * @returns Audit logs for that resource
 */
export async function getResourceAuditTrail(resourceType: AuditResourceType, resourceId: string) {
  return await getAuditLogs({
    resourceTypes: [resourceType],
    resourceId,
  });
}

/**
 * Get audit logs for a specific user
 *
 * Useful for user activity reports and security investigations.
 *
 * @param workosUserId - WorkOS user ID
 * @param startDate - Optional start date
 * @param endDate - Optional end date
 * @returns Audit logs for that user
 */
export async function getUserAuditLogs(workosUserId: string, startDate?: Date, endDate?: Date) {
  return await getAuditLogs({
    workosUserId,
    startDate,
    endDate,
  });
}

/**
 * Generate compliance report
 *
 * Aggregates audit data for compliance reporting (HIPAA, GDPR, etc.)
 *
 * @param startDate - Report start date
 * @param endDate - Report end date
 * @returns Compliance report summary
 */
export async function generateComplianceReport(startDate: Date, endDate: Date) {
  const logs = await getAuditLogs({ startDate, endDate });

  // Aggregate by action category
  const summary = {
    totalEvents: logs.length,
    medicalRecordAccess: logs.filter((log) => log.action.includes('MEDICAL_RECORD')).length,
    appointmentEvents: logs.filter((log) => log.action.includes('APPOINTMENT')).length,
    paymentEvents: logs.filter((log) => log.action.includes('PAYMENT')).length,
    securityEvents: logs.filter(
      (log) => log.action.includes('SECURITY') || log.action.includes('UNAUTHORIZED'),
    ).length,
    prescriptionEvents: logs.filter((log) => log.action.includes('PRESCRIPTION')).length,
  };

  // Group by user
  const byUser = logs.reduce(
    (acc, log) => {
      if (!acc[log.workosUserId]) {
        acc[log.workosUserId] = [];
      }
      acc[log.workosUserId].push(log);
      return acc;
    },
    {} as Record<string, typeof logs>,
  );

  // Group by day
  const byDay = logs.reduce(
    (acc, log) => {
      const day = log.createdAt.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = 0;
      }
      acc[day]++;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    summary,
    byUser,
    byDay,
    logs,
  };
}
