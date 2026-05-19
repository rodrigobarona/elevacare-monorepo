/**
 * replay-event.ts
 *
 * Replays a single Stripe webhook event by id, re-running the
 * processStripeEvent dispatcher against it. Use to recover from:
 *
 *   - "ignored" rows that should be re-processed (e.g. after F1 lands
 *     and the billing_customers mirror gets backfilled).
 *   - "failed" rows that are actually re-processable.
 *   - "received" rows stuck because of a worker crash.
 *
 * Resets the row's status to 'received' before re-fetching the event
 * from Stripe and dispatching. Idempotent: the processStripeEvent
 * state machine itself handles concurrent replay attempts via the
 * three-state claim.
 *
 * Usage:
 *   pnpm --filter @eleva/infra-stripe replay:event evt_1NxYz...
 *   pnpm --filter @eleva/infra-stripe replay:event evt_1NxYz... evt_2A...
 *
 * Reads STRIPE_SECRET_KEY, DATABASE_URL from .env.local.
 */

import { eq, sql } from "drizzle-orm"
import {
  processStripeEvent,
  stripe,
  type StripeEventResult,
} from "@eleva/billing/server"
import { main as schema, withPlatformAdminContext } from "@eleva/db"

async function run() {
  const eventIds = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  if (eventIds.length === 0) {
    console.error("[replay] Usage: replay:event <evt_id> [<evt_id> ...]")
    process.exit(1)
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[replay] STRIPE_SECRET_KEY not set")
    process.exit(1)
  }

  for (const eventId of eventIds) {
    console.log(`[replay] Processing ${eventId}...`)
    try {
      // Reset the row to allow the claim to re-acquire it. Without this,
      // 'processed' or 'ignored' rows would short-circuit to duplicate.
      await withPlatformAdminContext(async (tx) => {
        await tx
          .update(schema.stripeWebhookEvents)
          .set({
            status: "received",
            error: null,
            ignoreReason: null,
            // Keep attempts so we can see how many times we've replayed.
            attempts: sql`${schema.stripeWebhookEvents.attempts}`,
          })
          .where(eq(schema.stripeWebhookEvents.eventId, eventId))
      })

      const event = await stripe().events.retrieve(eventId)
      const result: StripeEventResult = await processStripeEvent(event)
      logResult(eventId, result)
    } catch (err) {
      console.error(
        `[replay] FAILED for ${eventId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}

function logResult(eventId: string, result: StripeEventResult): void {
  switch (result.status) {
    case "processed":
      console.log(`[replay] ${eventId} -> processed (${result.eventType})`)
      return
    case "ignored":
      console.log(
        `[replay] ${eventId} -> ignored (${result.eventType}): ${result.reason}`
      )
      return
    case "failed":
      console.error(
        `[replay] ${eventId} -> failed (${result.eventType}): ${result.error}`
      )
      return
    case "duplicate":
      // Should not happen because we reset to 'received' first; if it
      // does, the row is already terminal and concurrent replay has
      // nothing to do.
      console.warn(`[replay] ${eventId} -> duplicate (already terminal)`)
      return
  }
}

run().catch((err) => {
  console.error("[replay] Fatal:", err)
  process.exit(1)
})
