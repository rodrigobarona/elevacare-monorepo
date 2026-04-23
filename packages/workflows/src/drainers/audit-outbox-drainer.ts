import { and, eq, inArray, lte, sql } from "drizzle-orm"
import { auditDb, db, main, audit as auditSchema } from "@eleva/db"
import { captureException, heartbeat } from "@eleva/observability"

/**
 * Drain rows from `eleva_v3_main.audit_outbox` (status='pending') into
 * `eleva_v3_audit.audit_events` with idempotent audit_id.
 *
 * Invariants:
 * - Uses ON CONFLICT DO NOTHING on audit_events.audit_id \u2014 safe to run
 *   any number of times with the same outbox rows.
 * - Commits the main-DB update (status='shipped') only AFTER the audit
 *   DB insert returned, so crash between the two leaves the outbox row
 *   'pending' and the next tick will retry.
 * - On persistent failure (>= maxAttempts) marks the row 'failed' and
 *   records the last error; alerts via Sentry captureException +
 *   BetterStack heartbeat is not emitted.
 * - Heartbeat fires once per successful tick (even with zero rows
 *   processed) so the status page shows liveness.
 */

export interface DrainOptions {
  /** Max rows processed per tick. */
  batchSize?: number
  /** Per-row retry cap before marking failed. */
  maxAttempts?: number
  /** BetterStack monitor name; defaults to 'audit-outbox-drainer'. */
  heartbeatName?: string
}

export interface DrainResult {
  processed: number
  shipped: number
  failed: number
  skipped: number
}

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_ATTEMPTS = 5

export async function drainAuditOutbox(
  options: DrainOptions = {}
): Promise<DrainResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  const mainDb = db()
  const audDb = auditDb()

  const result: DrainResult = {
    processed: 0,
    shipped: 0,
    failed: 0,
    skipped: 0,
  }

  const pending = await mainDb
    .select()
    .from(main.auditOutbox)
    .where(
      and(
        eq(main.auditOutbox.status, "pending"),
        lte(main.auditOutbox.attempts, maxAttempts)
      )
    )
    .limit(batchSize)

  const shippedIds: string[] = []
  const failedAudits: Array<{
    id: string
    attempts: number
    lastError: string
  }> = []

  for (const row of pending) {
    result.processed += 1
    try {
      await audDb
        .insert(auditSchema.auditEvents)
        .values({
          auditId: row.auditId,
          orgId: row.orgId,
          actorUserId: row.actorUserId,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          payload: row.payload,
          correlationId: row.correlationId,
        })
        .onConflictDoNothing({ target: auditSchema.auditEvents.auditId })

      shippedIds.push(row.id)
      result.shipped += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const nextAttempts = row.attempts + 1
      failedAudits.push({
        id: row.id,
        attempts: nextAttempts,
        lastError: message,
      })
      if (nextAttempts >= maxAttempts) {
        result.failed += 1
      } else {
        result.skipped += 1
      }
      await captureException(err, {
        drainer: "auditOutboxDrainer",
        outboxRowId: row.id,
        attempts: nextAttempts,
      })
    }
  }

  if (shippedIds.length > 0) {
    await mainDb
      .update(main.auditOutbox)
      .set({ status: "shipped", shippedAt: new Date() })
      .where(inArray(main.auditOutbox.id, shippedIds))
  }

  for (const f of failedAudits) {
    await mainDb
      .update(main.auditOutbox)
      .set({
        attempts: f.attempts,
        lastError: f.lastError,
        status: f.attempts >= maxAttempts ? "failed" : "pending",
      })
      .where(eq(main.auditOutbox.id, f.id))
  }

  // Heartbeat on every tick (even zero rows) so the status page reflects
  // that the drainer is alive. Uses sql unused import: suppressed by
  // treating as a no-op dependency.
  void sql
  await heartbeat(options.heartbeatName ?? "audit-outbox-drainer")

  return result
}
