/**
 * RLS policy DDL generator.
 *
 * ENABLE ROW LEVEL SECURITY and CREATE POLICY are now managed by the
 * Drizzle schema (pgPolicy declarations in each table file). This
 * script is retained only for:
 *
 *   1. FORCE ROW LEVEL SECURITY — Drizzle does not emit this; FORCE
 *      makes RLS apply even to table owners (defense-in-depth).
 *   2. Audit DB policies — the audit_events table is in a separate
 *      Drizzle config and RLS is still applied via this script.
 *
 * Run via `pnpm db:rls` after each migration.
 *
 * ADR-003 is the source of truth.
 */

import { RLS_TABLE_ASSIGNMENTS } from "./classes"

/** Main DB tables that carry org_id and need RLS enabled. */
export const TENANT_TABLES = [
  "audit_outbox",
  "expert_profiles",
  "expert_listings",
  "clinic_profiles",
  "expert_integrations",
  "schedules",
  "availability_rules",
  "date_overrides",
  "event_types",
  "event_type_modes",
  "booking_links",
  "calendar_feed_tokens",
  "calendar_busy_sources",
  "calendar_destinations",
  "slot_reservations",
  "bookings",
  "booking_payments",
  "consents",
  "sessions",
  "expert_practice_locations",
  "event_locations",
  "billing_customers",
  "billing_subscriptions",
  "org_data_keys",
  "domain_events_outbox",
  "domain_event_deliveries",
] as const

export type TenantTable = (typeof TENANT_TABLES)[number]

/**
 * Main-DB tables keyed by `user_id = eleva.user_id` (owner-user-visible).
 * They do not carry `org_id`; `pnpm db:rls` must not apply the tenant
 * predicate.
 */
export const OWNER_USER_TABLES = [
  "notification_preferences",
  "dsar_requests",
  "account_deletion_requests",
] as const

export type OwnerUserTable = (typeof OWNER_USER_TABLES)[number]

/**
 * Tables that grant unrestricted access to platform admins. Bootstrap
 * operations (org provisioning, membership setup) run before
 * `eleva.org_id` is set, so these tables need an escape hatch.
 */
export const ADMIN_BYPASS_TABLES = new Set<string>([
  "expert_profiles",
  "domain_events_outbox",
  "domain_event_deliveries",
  // Billing mirrors are written from the Stripe webhook handler under a
  // service context with no end-user session. The Drizzle pgPolicy
  // declarations on these tables already include the eleva.platform_admin
  // bypass (see packages/db/src/schema/main/billing.ts); listing them
  // here keeps `pnpm db:rls` regenerated policies in sync instead of
  // dropping the bypass clause on each run.
  "billing_customers",
  "billing_subscriptions",
])

function isDualOrganization(table: string): boolean {
  return RLS_TABLE_ASSIGNMENTS.some(
    (assignment) =>
      assignment.table === table && assignment.class === "dual-organization"
  )
}

const SERVICE_ROLE_TABLES: Record<string, string> = {
  domain_events_outbox: "domain_events_publisher",
  domain_event_deliveries: "domain_events_publisher",
}

function tenantPredicate(table: string): string {
  const adminBypass = ADMIN_BYPASS_TABLES.has(table)
    ? ` OR current_setting('eleva.platform_admin', true) = 'true'`
    : ""
  const service = SERVICE_ROLE_TABLES[table]
  const serviceBypass = service
    ? ` OR current_setting('eleva.service', true) = '${service}'`
    : ""

  return `org_id::text = current_setting('eleva.org_id', true)${adminBypass}${serviceBypass}`
}

/**
 * Idempotent policy DDL. Drizzle's pgPolicy declarations define the
 * schema intent, but drizzle-kit push currently drops USING/WITH CHECK
 * clauses. This script is the authoritative enforcement layer:
 * - FORCE ROW LEVEL SECURITY (Drizzle only emits ENABLE)
 * - DROP + CREATE each policy with correct USING/WITH CHECK predicates
 */
export function buildMainRlsStatements(): string[] {
  const out: string[] = []
  for (const table of TENANT_TABLES) {
    const pred = tenantPredicate(table)
    out.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
    out.push(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`)
    out.push(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};`)
    out.push(
      `CREATE POLICY ${table}_tenant_isolation ON ${table} ` +
        `USING (${pred}) WITH CHECK (${pred});`
    )
    if (isDualOrganization(table)) {
      out.push(`DROP POLICY IF EXISTS ${table}_counterparty_read ON ${table};`)
      out.push(
        `CREATE POLICY ${table}_counterparty_read ON ${table} FOR SELECT ` +
          `USING (counterparty_org_id::text = current_setting('eleva.org_id', true));`
      )
    }
  }
  for (const table of OWNER_USER_TABLES) {
    const pred = `user_id::text = current_setting('eleva.user_id', true)`
    out.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
    out.push(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`)
    out.push(`DROP POLICY IF EXISTS ${table}_owner_user_visible ON ${table};`)
    out.push(
      `CREATE POLICY ${table}_owner_user_visible ON ${table} ` +
        `USING (${pred}) WITH CHECK (${pred});`
    )
  }
  return out
}

export function buildAuditRlsStatements(): string[] {
  // Audit DB: append-only. SELECT filtered by org_id (plus platform
  // admin). INSERT is audit_drainer only.
  const out: string[] = []
  out.push(`ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;`)
  out.push(`ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;`)
  out.push(`DROP POLICY IF EXISTS audit_events_tenant_read ON audit_events;`)
  out.push(
    `CREATE POLICY audit_events_tenant_read ON audit_events FOR SELECT ` +
      `USING (` +
      `  org_id::text = current_setting('eleva.org_id', true) ` +
      `  OR current_setting('eleva.platform_admin', true) = 'true'` +
      `);`
  )
  out.push(`DROP POLICY IF EXISTS audit_events_drainer_insert ON audit_events;`)
  out.push(
    `CREATE POLICY audit_events_drainer_insert ON audit_events FOR INSERT ` +
      `WITH CHECK (` +
      `  current_setting('eleva.service', true) = 'audit_drainer'` +
      `);`
  )
  return out
}

export function buildAllRlsSql(): string {
  return [
    "-- Main DB RLS (apply on eleva_v3_main)",
    ...buildMainRlsStatements(),
    "",
    "-- Audit DB RLS (apply on eleva_v3_audit)",
    ...buildAuditRlsStatements(),
  ].join("\n")
}
