import { and, eq, lt, or, sql } from "drizzle-orm"
import { main, withPlatformAdminContext } from "@eleva/db"
import { captureException, heartbeat } from "@eleva/observability"

/**
 * Stripe webhook stuck-event detector. Finds events sitting in
 * non-terminal states (`received` or `processing`) past their
 * expected window and surfaces them via Sentry + an optional
 * BetterStack heartbeat.
 *
 * Ops can also query the table directly:
 *
 *   SELECT event_id, event_type, status, attempts, last_attempt_at
 *   FROM stripe_webhook_events
 *   WHERE status IN ('received', 'processing')
 *     AND received_at < now() - interval '15 minutes'
 *   ORDER BY received_at ASC;
 *
 * Recovery: replay any stuck event with
 *   pnpm --filter @eleva/infra-stripe replay:event evt_xxx
 *
 * Per ADR-016 + the production-readiness briefing: this is the
 * alerting half of the F2 retry/recovery contract.
 */

export interface StuckEventOptions {
  /** Threshold (ms) for `received` rows. Default 15 min. */
  receivedAgeMs?: number
  /** Threshold (ms) for `processing` rows (worker may have died). Default 10 min. */
  processingAgeMs?: number
  /** Max rows reported per scan. */
  batchSize?: number
  /**
   * Heartbeat name for the BetterStack monitor. Heartbeat fires when the
   * scan completes (regardless of whether stuck rows were found) so the
   * status page shows liveness of the alerting job itself.
   */
  heartbeatName?: string
}

export interface StuckEvent {
  eventId: string
  eventType: string
  status: "received" | "processing"
  attempts: number
  receivedAt: Date
  lastAttemptAt: Date | null
  resolvedOrgId: string | null
}

export interface StuckEventReport {
  scanned: Date
  stuck: StuckEvent[]
}

const DEFAULT_RECEIVED_AGE_MS = 15 * 60 * 1000
const DEFAULT_PROCESSING_AGE_MS = 10 * 60 * 1000
const DEFAULT_BATCH_SIZE = 50

/**
 * Scan for stuck Stripe webhook events. For each match, fire a
 * Sentry event tagged with the event id, type, and age, so on-call
 * sees them immediately. Always returns the list so callers (cron,
 * tests) can inspect.
 */
export async function detectStuckStripeEvents(
  options: StuckEventOptions = {}
): Promise<StuckEventReport> {
  const receivedAgeMs = options.receivedAgeMs ?? DEFAULT_RECEIVED_AGE_MS
  const processingAgeMs = options.processingAgeMs ?? DEFAULT_PROCESSING_AGE_MS
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE

  const now = new Date()
  const receivedCutoff = new Date(now.getTime() - receivedAgeMs)
  const processingCutoff = new Date(now.getTime() - processingAgeMs)

  const rows = await withPlatformAdminContext(async (tx) => {
    return tx
      .select({
        eventId: main.stripeWebhookEvents.eventId,
        eventType: main.stripeWebhookEvents.eventType,
        status: main.stripeWebhookEvents.status,
        attempts: main.stripeWebhookEvents.attempts,
        receivedAt: main.stripeWebhookEvents.receivedAt,
        lastAttemptAt: main.stripeWebhookEvents.lastAttemptAt,
        resolvedOrgId: main.stripeWebhookEvents.resolvedOrgId,
      })
      .from(main.stripeWebhookEvents)
      .where(
        or(
          and(
            eq(main.stripeWebhookEvents.status, "received"),
            lt(main.stripeWebhookEvents.receivedAt, receivedCutoff)
          ),
          and(
            eq(main.stripeWebhookEvents.status, "processing"),
            lt(
              sql`coalesce(${main.stripeWebhookEvents.lastAttemptAt}, ${main.stripeWebhookEvents.receivedAt})`,
              processingCutoff
            )
          )
        )
      )
      .orderBy(main.stripeWebhookEvents.receivedAt)
      .limit(batchSize)
  })

  const stuck: StuckEvent[] = rows.map((r) => ({
    eventId: r.eventId,
    eventType: r.eventType,
    status: r.status as "received" | "processing",
    attempts: r.attempts,
    receivedAt: r.receivedAt,
    lastAttemptAt: r.lastAttemptAt,
    resolvedOrgId: r.resolvedOrgId,
  }))

  for (const event of stuck) {
    const ageMs = now.getTime() - event.receivedAt.getTime()
    void captureException(
      new Error(
        `Stripe webhook stuck in ${event.status} for ${Math.round(ageMs / 1000)}s: ${event.eventType} (${event.eventId})`
      ),
      {
        stripeEventId: event.eventId,
        stripeEventType: event.eventType,
        stripeEventStatus: event.status,
        attempts: event.attempts,
        ageSeconds: Math.round(ageMs / 1000),
        resolvedOrgId: event.resolvedOrgId,
      }
    ).catch(() => {})
  }

  // Heartbeat ALWAYS fires (even when stuck=0) so monitors confirm
  // the detector itself is running.
  if (options.heartbeatName) {
    void heartbeat(options.heartbeatName).catch(() => {})
  }

  return { scanned: now, stuck }
}
