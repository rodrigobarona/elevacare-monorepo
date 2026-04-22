/**
 * WorkOS Audit Logging Integration
 *
 * Logs authentication and organization events to WorkOS Audit Logs.
 * These appear in the WorkOS Admin Portal for customer transparency.
 *
 * Use WorkOS for:
 * - Authentication events (sign-in, sign-out, password changes)
 * - Organization events (member invitations, role changes)
 * - Subscription events
 *
 * Use custom DB audit logs (audit-workos.ts) for:
 * - PHI access (medical records, appointments)
 * - Payment events
 * - Health data access
 *
 * @see https://workos.com/docs/audit-logs
 */

'use server';

import { workos } from '@/lib/integrations/workos/client';

/**
 * WorkOS Audit Logging Integration
 *
 * Logs authentication and organization events to WorkOS Audit Logs.
 * These appear in the WorkOS Admin Portal for customer transparency.
 *
 * Use WorkOS for:
 * - Authentication events (sign-in, sign-out, password changes)
 * - Organization events (member invitations, role changes)
 * - Subscription events
 *
 * Use custom DB audit logs (audit-workos.ts) for:
 * - PHI access (medical records, appointments)
 * - Payment events
 * - Health data access
 *
 * @see https://workos.com/docs/audit-logs
 */

/**
 * WorkOS Audit Logging Integration
 *
 * Logs authentication and organization events to WorkOS Audit Logs.
 * These appear in the WorkOS Admin Portal for customer transparency.
 *
 * Use WorkOS for:
 * - Authentication events (sign-in, sign-out, password changes)
 * - Organization events (member invitations, role changes)
 * - Subscription events
 *
 * Use custom DB audit logs (audit-workos.ts) for:
 * - PHI access (medical records, appointments)
 * - Payment events
 * - Health data access
 *
 * @see https://workos.com/docs/audit-logs
 */

/**
 * WorkOS Audit Logging Integration
 *
 * Logs authentication and organization events to WorkOS Audit Logs.
 * These appear in the WorkOS Admin Portal for customer transparency.
 *
 * Use WorkOS for:
 * - Authentication events (sign-in, sign-out, password changes)
 * - Organization events (member invitations, role changes)
 * - Subscription events
 *
 * Use custom DB audit logs (audit-workos.ts) for:
 * - PHI access (medical records, appointments)
 * - Payment events
 * - Health data access
 *
 * @see https://workos.com/docs/audit-logs
 */

/**
 * Log event to WorkOS Audit Logs
 *
 * Events appear in WorkOS Admin Portal where customers can view them.
 *
 * @param orgId - Organization ID
 * @param event - Event details
 *
 * @example
 * ```typescript
 * await logWorkOSAuditEvent(session.organizationId, {
 *   action: 'user.signed_in',
 *   actor: {
 *     id: session.userId,
 *     type: 'user',
 *     name: user.email,
 *   },
 *   context: {
 *     location: req.geo?.city || 'unknown',
 *     userAgent: req.headers.get('user-agent') || 'unknown',
 *   },
 * });
 * ```
 */
export async function logWorkOSAuditEvent(
  orgId: string,
  event: {
    action: string; // e.g., 'user.signed_in', 'org.member_invited'
    actor: {
      id: string;
      type: 'user' | 'system';
      name?: string;
    };
    targets?: Array<{
      id: string;
      type: string;
    }>;
    context: {
      location: string;
      userAgent: string;
    };
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await workos.auditLogs.createEvent(
      orgId,
      {
        action: event.action,
        occurredAt: new Date(),
        actor: event.actor,
        targets: event.targets || [],
        context: event.context,
        metadata: event.metadata as Record<string, string | number | boolean> | undefined,
      },
      {
        // Optional idempotency key for request de-duplication
        idempotencyKey: `${event.action}-${event.actor.id}-${Date.now()}`,
      },
    );
  } catch (error) {
    // Log error but don't block user actions
    console.error('[WorkOS Audit Log Failed]', {
      error: error instanceof Error ? error.message : String(error),
      orgId,
      action: event.action,
    });
  }
}
