import { stripe } from "./client"

const CANCELABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "requires_capture",
])

/**
 * Cancel PaymentIntents that are still cancelable. Must run outside any
 * database transaction. Never refunds.
 */
export async function cancelCancelablePaymentIntents(
  paymentIntentIds: readonly string[]
): Promise<void> {
  for (const id of paymentIntentIds) {
    try {
      const intent = await stripe().paymentIntents.retrieve(id)
      if (!CANCELABLE_STATUSES.has(intent.status)) continue
      await stripe().paymentIntents.cancel(id)
    } catch (err) {
      console.error("[billing] cancel PaymentIntent failed", { id, err })
    }
  }
}
