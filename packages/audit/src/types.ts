/**
 * Closed unions for audit events. Extended per sprint as new mutating
 * server actions come online. Keeping these as closed unions means
 * CodeRabbit + tsc catch typos at withAudit call sites.
 */

// Entities covered so far. Each subsequent sprint appends here.
export type AuditEntity =
  | "user"
  | "organization"
  | "membership"
  | "role"
  | "permission"
  // S2 — Become-Partner + expert lifecycle
  | "become_partner_application"
  | "expert_profile"
  | "expert_integration_credential"

// Action verbs follow "<verb>" shape and are combined with entity in
// stored rows as "<entity>.<action>" to keep downstream filtering simple.
export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "role_changed"
  | "status_changed"
  | "invited"
  | "accepted"
  | "removed"
  // S2 — Become-Partner + expert lifecycle
  | "submitted"
  | "approved"
  | "rejected"
  | "claimed"
  | "connected"
  | "disconnected"

export interface AuditContext {
  /** UUID v4 \u2014 row ID in audit_outbox and audit_events (idempotent key). */
  auditId: string
  /** Correlation ID from the inbound request (for cross-system tracing). */
  correlationId?: string
  /** Current WorkOS session user ID (null for anonymous / system actions). */
  actorUserId?: string
  /** Tenant boundary; required except for platform-admin audits. */
  orgId: string
}

export interface AuditRecord<P = Record<string, unknown>> {
  auditId: string
  orgId: string
  actorUserId: string | null
  action: AuditAction
  entity: AuditEntity
  entityId: string | null
  payload: P
  correlationId: string | null
}
