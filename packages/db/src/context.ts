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
  return withLocalSettings({ "eleva.org_id": orgId }, fn)
}

/**
 * Tenant + owner-user settings in one transaction. Use when a mutation
 * writes both tenant-owned rows and owner-user-visible tables
 * (notification_preferences, later DSAR / deletion).
 */
export async function withOrgAndUserContext<T>(
  orgId: string,
  userId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return withLocalSettings(
    { "eleva.org_id": orgId, "eleva.user_id": userId },
    fn
  )
}

/**
 * Owner-user-visible queries (`user_id = eleva.user_id`). Required for
 * `notification_preferences` and the other member-privacy tables.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return withLocalSettings({ "eleva.user_id": userId }, fn)
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
  return withLocalSettings({ "eleva.platform_admin": "true" }, fn)
}

/**
 * Platform-admin plus the acting member's user id. Member `/me` writes
 * that span expert-org consents still need `eleva.user_id` for
 * owner-user-visible tables in the same transaction.
 */
export async function withPlatformAdminUserContext<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return withLocalSettings(
    { "eleva.platform_admin": "true", "eleva.user_id": userId },
    fn
  )
}

type ElevaGuc = "eleva.org_id" | "eleva.user_id" | "eleva.platform_admin"

async function withLocalSettings<T>(
  settings: Partial<Record<ElevaGuc, string>>,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const client = getTxDb()
  return client.transaction(async (tx) => {
    await applyIntegrationTestRole(tx)
    for (const key of Object.keys(settings) as ElevaGuc[]) {
      const value = settings[key]
      if (value === undefined) continue
      await setConfig(tx, key, value)
    }
    return fn(tx)
  })
}

async function setConfig(tx: Tx, key: ElevaGuc, value: string): Promise<void> {
  switch (key) {
    case "eleva.org_id":
      await tx.execute(sql`SELECT set_config('eleva.org_id', ${value}, true)`)
      return
    case "eleva.user_id":
      await tx.execute(sql`SELECT set_config('eleva.user_id', ${value}, true)`)
      return
    case "eleva.platform_admin":
      await tx.execute(
        sql`SELECT set_config('eleva.platform_admin', ${value}, true)`
      )
      return
    default: {
      const _exhaustive: never = key
      throw new Error(`unknown eleva GUC: ${_exhaustive}`)
    }
  }
}

async function applyIntegrationTestRole(tx: Tx) {
  if (process.env.ELEVA_RLS_INTEGRATION !== "1") {
    return
  }
  await tx.execute(sql`SET LOCAL ROLE eleva_rls_test`)
}

export function __resetContextClientForTests() {
  globalForDb.__elevaTxDb = undefined
}
