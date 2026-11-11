import { and, asc, eq, inArray, lte, notInArray } from "drizzle-orm"
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
 * - Heartbeat fires once per successful run (even with zero rows
 *   processed) so the status page shows liveness.
 * - A run drains oldest first, batch after batch, until nothing is
 *   pending or `maxBatches` is reached (`more` then says so). Rows that
 *   fail in a run are not retried within it.
 * - Each shipped payload carries `occurredAt`, the time the outbox row
 *   was written.
 */

export interface DrainOptions {
  /** Rows read per batch. */
  batchSize?: number
  /** Batches per run; a run stops early when nothing is pending. */
  maxBatches?: number
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
  /** True when the run stopped at `maxBatches` with rows still pending. */
  more: boolean
}

const DEFAULT_BATCH_SIZE = 100
/** 2,000 rows a run: an hourly run keeps up with far more than a beta writes. */
const DEFAULT_MAX_BATCHES = 20
const DEFAULT_MAX_ATTEMPTS = 5

/**
 * The durable log has one time column, `received_at`: when the row was
 * shipped, not when the thing happened. Carry the outbox row's own time in
 * the payload, so the log keeps the date and time of each event (an access
 * log of health data needs it: Lei 58/2019 art. 29).
 */
export function withOccurredAt(
  payload: Record<string, unknown>,
  createdAt: Date
): Record<string, unknown> {
  if (typeof payload.occurredAt === "string") return payload
  return { ...payload, occurredAt: createdAt.toISOString() }
}

export async function drainAuditOutbox(
  options: DrainOptions = {}
): Promise<DrainResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const maxBatches = options.maxBatches ?? DEFAULT_MAX_BATCHES
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  const mainDb = db()
  const audDb = auditDb()

  const result: DrainResult = {
    processed: 0,
    shipped: 0,
    failed: 0,
    skipped: 0,
    more: false,
  }
  // Rows that failed in this run stay pending for the next one; leaving
  // them out here keeps one bad row from being retried in a loop.
  const triedAndFailed: string[] = []

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const pending = await mainDb
      .select()
      .from(main.auditOutbox)
      .where(
        and(
          eq(main.auditOutbox.status, "pending"),
          lte(main.auditOutbox.attempts, maxAttempts),
          triedAndFailed.length > 0
            ? notInArray(main.auditOutbox.id, triedAndFailed)
            : undefined
        )
      )
      // Oldest first, so nothing waits behind newer rows.
      .orderBy(asc(main.auditOutbox.createdAt))
      .limit(batchSize)
    if (pending.length === 0) break

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
            payload: withOccurredAt(row.payload, row.createdAt),
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
        triedAndFailed.push(row.id)
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

    if (pending.length < batchSize) break
    if (batch === maxBatches - 1) result.more = true
  }

  // Heartbeat on every run (even zero rows) so the status page reflects
  // that the drainer is alive.
  await heartbeat(options.heartbeatName ?? "audit-outbox-drainer")

  return result
}
