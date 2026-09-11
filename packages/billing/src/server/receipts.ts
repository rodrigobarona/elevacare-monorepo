import { stripe } from "./client"

export type ChargeReceipt = {
  receiptUrl: string
  stripeChargeId: string
}

/**
 * Resolve Stripe `charges.receipt_url` without importing the SDK
 * outside this package. Callers must persist the result outside any
 * database transaction.
 */
export async function retrieveChargeReceipt(input: {
  stripeChargeId?: string | null
  stripePaymentIntentId?: string | null
}): Promise<ChargeReceipt | null> {
  if (input.stripeChargeId) {
    const charge = await stripe().charges.retrieve(input.stripeChargeId)
    if (!charge.receipt_url) return null
    return { receiptUrl: charge.receipt_url, stripeChargeId: charge.id }
  }

  if (!input.stripePaymentIntentId) return null

  const intent = await stripe().paymentIntents.retrieve(
    input.stripePaymentIntentId,
    { expand: ["latest_charge"] }
  )
  const charge = intent.latest_charge
  if (!charge || typeof charge === "string") return null
  if (!charge.receipt_url) return null
  return { receiptUrl: charge.receipt_url, stripeChargeId: charge.id }
}
