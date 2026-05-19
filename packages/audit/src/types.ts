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
  | "expert_profile"
  | "expert_integration_credential"
  | "event_type"
  | "schedule"
  | "blob"
  // Stripe billing surface (Phase 1 of stripe-foundation-review).
  // billing_customer/billing_subscription mirror Stripe state in our DB
  // for support tooling; entitlement decisions still come from the WorkOS
  // access-token entitlements claim (see ADR-016).
  | "billing_customer"
  | "billing_subscription"
  | "billing_invoice"
  | "billing_checkout"
  // billing_portal.session_minted is the multi-admin attribution anchor
  // (see ADR-016): we audit who minted a Customer Portal session URL,
  // then correlate with subsequent webhook events to infer the actor.
  | "billing_portal"
  // Stripe Connect platform + payouts (expert marketplace surface).
  | "connect_account"
  | "connect_payout"
  | "identity_verification"
  | "booking_payment"

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
  | "submitted"
  | "approved"
  | "rejected"
  | "claimed"
  | "connected"
  | "disconnected"
  | "published"
  | "unpublished"
  | "synced"
  | "uploaded"
  // Stripe billing lifecycle.
  | "canceled"
  | "reactivated"
  | "past_due_recovered"
  | "paid"
  | "payment_failed"
  | "requires_action"
  | "refunded"
  | "disputed"
  | "session_created"
  | "session_minted"
  // Connect platform / capabilities.
  | "capability_changed"
  | "deauthorized"
  // Connect payouts.
  | "succeeded"
  | "failed"
  // Identity verification.
  | "verified"
  | "requires_input"

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
