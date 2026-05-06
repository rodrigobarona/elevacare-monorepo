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

let _db: ReturnType<typeof buildMainClient> | null = null
let _auditDb: ReturnType<typeof buildAuditClient> | null = null

export function db() {
  if (!_db) _db = buildMainClient()
  return _db
}

export function auditDb() {
  if (!_auditDb) _auditDb = buildAuditClient()
  return _auditDb
}

/**
 * Test hook \u2014 lets unit tests reset the cached clients between cases
 * when they mock env vars. Do NOT call in production code.
 */
export function __resetClientsForTests() {
  _db = null
  _auditDb = null
}

export { mainSchema, auditSchema }
