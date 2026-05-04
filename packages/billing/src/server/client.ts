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
 * The API version is pinned via env (default '2023-08-16' — the floor
 * for Connect Embedded Components per payments-payouts-spec.md).
 * Newer pinned versions are accepted; older ones cause Stripe to
 * reject AccountSession requests.
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
