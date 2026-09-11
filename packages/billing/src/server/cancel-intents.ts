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
