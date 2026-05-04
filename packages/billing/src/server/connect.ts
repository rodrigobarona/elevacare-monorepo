import { stripe } from "./client"
import type { CreateConnectAccountInput } from "./types"

/**
 * Create a Stripe Connect Express account for an expert.
 *
 * Per ADR-005 / payments-payouts-spec.md:
 * - Solo experts: Express controller, country='PT', currency='eur'
 * - Eleva metadata fields are stamped so webhook handlers can
 *   resolve back to the Eleva expert/org without an extra DB lookup.
 *
 * Idempotency: callers should pass an idempotency key derived from
 * the expert profile ID so retries do not create duplicate accounts.
 *
 * The returned account ID is persisted on
 * `expert_profiles.stripe_account_id` by the caller (within
 * withAudit).
 */
export async function createConnectAccount(
  input: CreateConnectAccountInput,
  options: { idempotencyKey?: string } = {}
): Promise<{ id: string; detailsSubmitted: boolean }> {
  const account = await stripe().accounts.create(
    {
      controller: {
        stripe_dashboard: { type: "express" },
        fees: { payer: "application" },
        losses: { payments: "application" },
      },
      country: input.country ?? "PT",
      email: input.email,
      default_currency: input.defaultCurrency ?? "eur",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        eleva_expert_profile_id: input.expertProfileId,
        eleva_org_id: input.orgId,
      },
      settings: input.preferredLocale
        ? {
            // Hint Stripe-generated emails locale; user can override later.
          }
        : undefined,
    },
    options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : undefined
  )

  return {
    id: account.id,
    detailsSubmitted: account.details_submitted ?? false,
  }
}
