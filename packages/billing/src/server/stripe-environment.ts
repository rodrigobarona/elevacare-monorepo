import type Stripe from "stripe"

/**
 * Local dev, previews and production can share one Stripe test account, so
 * every webhook endpoint receives every environment's events. Booking
 * objects carry the environment that created them; a webhook ignores events
 * from another environment instead of failing on rows it does not have
 * (Sentry 28324c4f, 2026-10-29: production tried to confirm a local booking).
 */
export const STRIPE_ENV_METADATA_KEY = "eleva_env"

export function stripeEnvironmentTag(
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): string {
  return vercelEnv || "development"
}

/** Reason to ignore an event created by another environment, else null. */
export function foreignEnvironmentReason(
  event: Pick<Stripe.Event, "data">,
  currentTag: string = stripeEnvironmentTag()
): string | null {
  const object = event.data.object as { metadata?: Record<string, string> }
  const tag = object.metadata?.[STRIPE_ENV_METADATA_KEY]
  if (!tag || tag === currentTag) return null
  return `foreign_environment:${tag}`
}
