"use client"

import { loadStripe } from "@stripe/stripe-js"

export type IdentityVerificationResult =
  | { ok: true }
  | { ok: false; message: string | null }

export async function verifyElevaIdentity(input: {
  publishableKey: string
  clientSecret: string
}): Promise<IdentityVerificationResult> {
  const stripe = await loadStripe(input.publishableKey)
  if (!stripe) return { ok: false, message: null }

  const result = await stripe.verifyIdentity(input.clientSecret)
  if (result.error) return { ok: false, message: result.error.message ?? null }
  return { ok: true }
}
