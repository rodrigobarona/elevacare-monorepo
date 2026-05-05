import { neon } from "@neondatabase/serverless"

import { requireAuditDbEnv, requireDbEnv } from "@eleva/config/env"

/**
 * Lightweight liveness pings for the Neon main + audit databases.
 *
 * Used by the keep-alive cron in `apps/api` so Neon's autosuspend timer
 * never runs out the clock on idle dev/preview deployments. We use the
 * `neon()` HTTP driver (single round-trip, no pool warm-up) instead of
 * `withPlatformAdminContext` because:
 *
 *  - `SELECT 1` does not touch any tenant table, so the RLS context
 *    we set in `withPlatformAdminContext` is irrelevant.
 *  - Avoiding the pool client also keeps the cron handler's cold
 *    start small in the Vercel Functions runtime.
 *
 * Both helpers throw on connection / auth errors so the route can
 * report the failure as 5xx and Sentry can capture it.
 */

export async function pingMainDb(): Promise<void> {
  const { DATABASE_URL } = requireDbEnv()
  const sql = neon(DATABASE_URL)
  await sql`SELECT 1`
}

export async function pingAuditDb(): Promise<void> {
  const { AUDIT_DATABASE_URL } = requireAuditDbEnv()
  const sql = neon(AUDIT_DATABASE_URL)
  await sql`SELECT 1`
}
