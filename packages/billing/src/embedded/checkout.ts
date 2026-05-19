"use client"

import { loadStripe } from "@stripe/stripe-js"

export interface EmbeddedCheckout {
  mount: (element: HTMLElement) => void
  destroy: () => void
}

interface StripeWithEmbeddedCheckout {
  initEmbeddedCheckout: (options: {
    fetchClientSecret: () => Promise<string>
  }) => Promise<EmbeddedCheckout>
}

export async function initElevaEmbeddedCheckout(input: {
  publishableKey: string
  clientSecret: string
}): Promise<EmbeddedCheckout> {
  const stripe = await loadStripe(input.publishableKey)
  if (!stripe) throw new Error("Stripe failed to load")

  const embeddedStripe = stripe as unknown as StripeWithEmbeddedCheckout
  return embeddedStripe.initEmbeddedCheckout({
    fetchClientSecret: async () => input.clientSecret,
  })
}
