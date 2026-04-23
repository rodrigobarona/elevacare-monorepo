import { neon } from "@neondatabase/serverless"
import { buildAuditRlsStatements, buildMainRlsStatements } from "./policies"
import { requireAuditDbEnv, requireDbEnv } from "@eleva/config/env"

/**
 * Idempotent RLS application. Executes the DDL from policies.ts against
 * the main + audit databases. Call as part of `pnpm db:push` or manually
 * via `pnpm --filter=@eleva/db db:rls`.
 *
 * Each statement is wrapped in its own try/catch so repeated runs do not
 * abort on the ALTER TABLE ... ENABLE ROW LEVEL SECURITY being already
 * enabled \u2014 DROP POLICY IF EXISTS + FORCE RLS keeps the end state
 * deterministic.
 */

async function executeAll(
  connectionString: string,
  stmts: string[],
  label: string
) {
  const sql = neon(connectionString)
  // eslint-disable-next-line no-console
  console.log(`[rls] applying ${stmts.length} statements to ${label}`)
  for (const stmt of stmts) {
    try {
      await sql.query(stmt)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[rls] failed on ${label}:`, stmt)
      throw err
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[rls] ${label} done`)
}

export async function applyMainRls() {
  const { DATABASE_URL } = requireDbEnv()
  return executeAll(DATABASE_URL, buildMainRlsStatements(), "main")
}

export async function applyAuditRls() {
  const { AUDIT_DATABASE_URL } = requireAuditDbEnv()
  return executeAll(AUDIT_DATABASE_URL, buildAuditRlsStatements(), "audit")
}

export async function applyAllRls() {
  await applyMainRls()
  await applyAuditRls()
}
