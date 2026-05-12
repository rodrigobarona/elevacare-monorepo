import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { requireAuditDbEnv, requireDbEnv } from "@eleva/config/env"

import * as mainSchema from "./schema/main/index"
import * as auditSchema from "./schema/audit/index"

/**
 * Main application database client. Reads/writes all tenant data.
 *
 * Consumers MUST go through withOrgContext() (src/context.ts) so the
 * connection has eleva.org_id set before any query \u2014 that setting is
 * what RLS policies key on.
 */
function buildMainClient() {
  const { DATABASE_URL } = requireDbEnv()
  return drizzle(neon(DATABASE_URL), { schema: mainSchema })
}

function buildAuditClient() {
  const { AUDIT_DATABASE_URL } = requireAuditDbEnv()
  return drizzle(neon(AUDIT_DATABASE_URL), { schema: auditSchema })
}

// Cache clients on `globalThis` so Turbopack/Next HMR reloads in
// development reuse the same instances rather than rebuilding them on
// every module re-evaluation. neon-http itself is stateless, but
// matching the pattern used by `context.ts` keeps singleton behavior
// uniform across the package.
const globalForDb = globalThis as unknown as {
  __elevaDb?: ReturnType<typeof buildMainClient>
  __elevaAuditDb?: ReturnType<typeof buildAuditClient>
}

export function db() {
  if (!globalForDb.__elevaDb) globalForDb.__elevaDb = buildMainClient()
  return globalForDb.__elevaDb
}

export function auditDb() {
  if (!globalForDb.__elevaAuditDb)
    globalForDb.__elevaAuditDb = buildAuditClient()
  return globalForDb.__elevaAuditDb
}

/**
 * Test hook \u2014 lets unit tests reset the cached clients between cases
 * when they mock env vars. Do NOT call in production code.
 */
export function __resetClientsForTests() {
  globalForDb.__elevaDb = undefined
  globalForDb.__elevaAuditDb = undefined
}

export { mainSchema, auditSchema }
