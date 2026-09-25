import { stripe } from "./client"

const CANCELABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "requires_capture",
  "processing",
])

export type CancelPaymentIntentOutcome = {
  id: string
  status: "cancelled" | "skipped" | "failed"
  reason?: string
}

function stripeErrorCode(err: unknown): string | undefined {
  let current: unknown = err
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      typeof (current as { code: unknown }).code === "string"
    ) {
      return (current as { code: string }).code
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined
  }
  return undefined
}

// A member may still complete these, so an expired hold must not release
// the slot: MB WAY sits in `processing` until approved in the app.
const IN_FLIGHT_STATUSES = new Set([
  "processing",
  "requires_capture",
  "succeeded",
])
const CANCEL_ON_EXPIRY_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
])
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ExpiredReservationIntentDecision =
  | { action: "release"; cancelledIntentIds: string[] }
  | { action: "keep"; paymentIntentId: string; reason: string }
  | { action: "retry"; reason: "search_empty" }

/**
 * Decide whether an expired reservation can release its slot. Finds the
 * intent by id, or by `metadata.reservationId` when tx B never stored it
 * (`intent_pending`), and cancels it when the member can no longer pay.
 * Stripe search is eventually consistent, so an empty search result is only
 * trusted once `searchMissIsFinal`; before that the caller should retry.
 * Must run outside any database transaction. Throws on Stripe errors so
 * the sweep retries on its next run.
 */
export async function settleExpiredReservationIntent(input: {
  reservationId: string
  paymentIntentId: string | null
  searchByReservation: boolean
  searchMissIsFinal: boolean
}): Promise<ExpiredReservationIntentDecision> {
  let intents: { id: string; status: string }[]
  if (input.paymentIntentId) {
    intents = [await stripe().paymentIntents.retrieve(input.paymentIntentId)]
  } else if (input.searchByReservation && UUID_RE.test(input.reservationId)) {
    const found = await stripe().paymentIntents.search({
      query: `metadata['reservationId']:'${input.reservationId}'`,
      limit: 10,
    })
    intents = found.data
    if (intents.length === 0 && !input.searchMissIsFinal) {
      return { action: "retry", reason: "search_empty" }
    }
  } else {
    intents = []
  }

  const inFlight = intents.find((i) => IN_FLIGHT_STATUSES.has(i.status))
  if (inFlight) {
    return {
      action: "keep",
      paymentIntentId: inFlight.id,
      reason: inFlight.status,
    }
  }

  const cancelledIntentIds: string[] = []
  for (const intent of intents) {
    if (!CANCEL_ON_EXPIRY_STATUSES.has(intent.status)) continue
    try {
      await stripe().paymentIntents.cancel(intent.id)
      cancelledIntentIds.push(intent.id)
    } catch (err) {
      if (stripeErrorCode(err) === "payment_intent_unexpected_state") {
        return {
          action: "keep",
          paymentIntentId: intent.id,
          reason: "payment_intent_unexpected_state",
        }
      }
      throw err
    }
  }
  return { action: "release", cancelledIntentIds }
}

/**
 * Cancel PaymentIntents that are still cancelable. Must run outside any
 * database transaction. Never refunds. Returns per-ID outcomes so callers
 * can retry failed IDs that remain on booking rows.
 */
export async function cancelCancelablePaymentIntents(
  paymentIntentIds: readonly string[]
): Promise<CancelPaymentIntentOutcome[]> {
  const outcomes: CancelPaymentIntentOutcome[] = []
  for (const id of paymentIntentIds) {
    try {
      const intent = await stripe().paymentIntents.retrieve(id)
      if (!CANCELABLE_STATUSES.has(intent.status)) {
        outcomes.push({ id, status: "skipped", reason: intent.status })
        continue
      }
      await stripe().paymentIntents.cancel(id)
      outcomes.push({ id, status: "cancelled" })
    } catch (err) {
      const code = stripeErrorCode(err)
      if (code === "payment_intent_unexpected_state") {
        outcomes.push({ id, status: "skipped", reason: code })
        continue
      }
      console.error("[billing] cancel PaymentIntent failed", { id, err })
      outcomes.push({
        id,
        status: "failed",
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return outcomes
}
