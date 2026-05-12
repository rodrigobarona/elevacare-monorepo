import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-serverless"
import { Pool } from "@neondatabase/serverless"
import { requireDbEnv } from "@eleva/config/env"

import * as mainSchema from "./schema/main/index"

/**
 * Tenant-scoped query runner (ADR-003).
 *
 * Every query that touches a tenant table MUST be wrapped in
 * withOrgContext(orgId, tx => ...). The wrapper:
 *   1. Opens a database transaction.
 *   2. Runs `SELECT set_config('eleva.org_id', $orgId, true)` so the
 *      setting is LOCAL to that transaction (reset on commit/rollback).
 *   3. Executes the caller-supplied function with the transactional
 *      Drizzle handle.
 *
 * Why the neon-serverless pool client instead of neon-http?
 *   \u2014 set_config is session-scoped; neon-http resets per-query. The
 *     pool variant holds a stable connection for the duration of the
 *     transaction so RLS sees the setting.
 *
 * Lint/CI rule (S1-A boundary): raw db() calls against tenant tables
 * outside withOrgContext() are rejected.
 */

export type Tx = Parameters<
  Parameters<ReturnType<typeof buildPoolClient>["transaction"]>[0]
>[0]

function buildPoolClient() {
  const { DATABASE_URL } = requireDbEnv()
  // Pool sizing + timeouts:
  //   - `max` caps concurrent connections so a runaway request burst (or a
  //     leaked pool from HMR) cannot exhaust Neon's per-project connection
  //     limit and silently hang every subsequent query.
  //   - `connectionTimeoutMillis` makes `pool.connect()` reject after 10s
  //     instead of waiting forever when the limit is reached.
  //   - `idleTimeoutMillis` reclaims sockets that no caller is using so
  //     they're returned to Neon promptly.
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  })
  return drizzle(pool, { schema: mainSchema })
}

// Cache the pool on `globalThis` so Turbopack/Next HMR re-evaluations of
// this module reuse the same `Pool` instance instead of leaking a fresh
// one on every reload (which holds open Neon connections until the dev
// server is restarted).
const globalForDb = globalThis as unknown as {
  __elevaTxDb?: ReturnType<typeof buildPoolClient>
}

function getTxDb() {
  if (!globalForDb.__elevaTxDb) globalForDb.__elevaTxDb = buildPoolClient()
  return globalForDb.__elevaTxDb
}

/**
 * Run `fn` inside a transaction whose eleva.org_id setting matches the
 * provided orgId. RLS policies on every tenant table filter rows by
 * that setting, so cross-tenant reads return 0 rows.
 */
export async function withOrgContext<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const client = getTxDb()
  return client.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('eleva.org_id', ${orgId}, true)`)
    return fn(tx)
  })
}

/**
 * Escape hatch for platform-admin queries that need cross-tenant reads
 * (e.g. Eleva operator dashboards, reconciliation jobs). Distinct setting
 * name so RLS policies that match eleva.org_id never accidentally pass.
 * Access itself must be wrapped in withAudit + gated by the
 * audit:view_all capability.
 */
export async function withPlatformAdminContext<T>(
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const client = getTxDb()
  return client.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('eleva.platform_admin', 'true', true)`
    )
    return fn(tx)
  })
}

export function __resetContextClientForTests() {
  globalForDb.__elevaTxDb = undefined
}
