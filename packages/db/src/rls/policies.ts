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

/** Main DB tables that carry org_id and need RLS enabled. */
export const TENANT_TABLES = [
  "organizations",
  "memberships",
  "audit_outbox",
  "expert_profiles",
  "expert_listings",
  "clinic_profiles",
  "expert_integrations",
  "become_partner_applications",
  "schedules",
  "availability_rules",
  "date_overrides",
  "event_types",
  "calendar_busy_sources",
  "calendar_destinations",
  "slot_reservations",
  "bookings",
  "sessions",
  "expert_practice_locations",
  "event_locations",
] as const

export type TenantTable = (typeof TENANT_TABLES)[number]

/**
 * organisations uses id (self-reference), become_partner_applications
 * uses applicant_org_id + platform admin escape hatch.
 */
const ORG_SELF_TABLES = new Set<string>(["organizations"])
const APPLICANT_ORG_TABLES = new Set<string>(["become_partner_applications"])

function tenantPredicate(table: string): string {
  if (ORG_SELF_TABLES.has(table)) {
    return `id::text = current_setting('eleva.org_id', true)`
  }
  if (APPLICANT_ORG_TABLES.has(table)) {
    return (
      `applicant_org_id::text = current_setting('eleva.org_id', true) ` +
      `OR current_setting('eleva.platform_admin', true) = 'true'`
    )
  }
  return `org_id::text = current_setting('eleva.org_id', true)`
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
  }
  return out
}

export function buildAuditRlsStatements(): string[] {
  // Audit DB: append-only. SELECT filtered by org_id match. INSERT
  // allowed at policy level (role-level grants further restrict to
  // drainer credentials in production).
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
      `WITH CHECK (true);`
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
