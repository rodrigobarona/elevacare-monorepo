/**
 * RLS policy DDL generator.
 *
 * Produces idempotent SQL statements applied after each migration. Run
 * via `pnpm db:rls` (see packages/db/package.json). The output is plain
 * SQL so operators can inspect it on the Neon dashboard.
 *
 * Policy keys:
 * - tenant tables  : USING org_id::text = current_setting('eleva.org_id', true)
 * - audit tables   : SELECT only; UPDATE/DELETE revoked at the role level
 *                    (installed by applyAuditRolePolicy).
 *
 * ADR-003 is the source of truth.
 */

/** Main DB tables that carry org_id and need RLS enabled. */
export const TENANT_TABLES = [
  "organizations",
  "memberships",
  "audit_outbox",
] as const

export type TenantTable = (typeof TENANT_TABLES)[number]

/**
 * organisations is special: the row's own id IS the tenant id (you can
 * only read your own org). That is a different predicate shape.
 */
const ORG_SELF_TABLES = new Set<string>(["organizations"])

function tenantPredicate(table: string): string {
  if (ORG_SELF_TABLES.has(table)) {
    return `id::text = current_setting('eleva.org_id', true)`
  }
  return `org_id::text = current_setting('eleva.org_id', true)`
}

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
