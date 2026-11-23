import Stripe from "stripe"
import { requireStripeEnv } from "@eleva/config/env"

type StripeApiVersion = ConstructorParameters<typeof Stripe>[1] extends
  | infer C
  | undefined
  ? C extends { apiVersion?: infer V }
    ? Exclude<V, undefined>
    : string
  : string

/**
 * Stripe SDK singleton (server-only).
 *
 * The Stripe library is imported here and only here. Boundary lint
 * forbids `from "stripe"` outside of `@eleva/billing/**`.
 *
 * The API version is pinned via env (`STRIPE_API_VERSION`; the example
 * names the installed SDK's own version). The floor is 2026-03-25.dahlia:
 * embedded Checkout's `ui_mode: "embedded_page"` does not exist before it.
 */

let cached: Stripe | null = null

export function stripe(): Stripe {
  if (cached) return cached
  const env = requireStripeEnv()
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: env.STRIPE_API_VERSION as StripeApiVersion,
    appInfo: {
      name: "Eleva.care",
      version: "3.0.0",
      url: "https://eleva.care",
    },
    typescript: true,
  })
  return cached
}

/**
 * Test-only hook. NEVER call from production code paths.
 */
export function __resetStripeForTests(): void {
  cached = null
}
