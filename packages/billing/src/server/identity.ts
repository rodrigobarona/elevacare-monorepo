import { stripe } from "./client"
import type { IdentityVerificationSession } from "./types"

/**
 * Create a Stripe Identity verification session for an expert.
 *
 * Identity is mounted as an embedded modal in step 3 of the expert
 * onboarding wizard (apps/app/(expert)/onboarding/step-3-identity).
 * The returned `client_secret` is passed to Stripe's loadStripe
 * client and never stored in our DB.
 *
 * Webhook follow-up (S4):
 * - identity.verification_session.verified -> set
 *   expert_profiles.stripe_identity_status='verified'
 * - identity.verification_session.requires_input -> reset to
 *   'requires_input' so the UI surfaces a retry banner
 *
 * Idempotency: callers pass `expertProfileId` as the idempotency
 * key so retries during the wizard don't open multiple sessions.
 */
export async function createIdentityVerificationSession(input: {
  expertProfileId: string
  orgId: string
  /** Optional connected-account ID (PT — verifications run on the platform). */
  stripeAccountId?: string
}): Promise<IdentityVerificationSession> {
  const session = await stripe().identity.verificationSessions.create(
    {
      type: "document",
      metadata: {
        eleva_expert_profile_id: input.expertProfileId,
        eleva_org_id: input.orgId,
      },
      options: {
        document: {
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    },
    { idempotencyKey: `identity_${input.expertProfileId}` }
  )

  if (!session.client_secret) {
    throw new Error("Stripe Identity returned no client_secret")
  }

  return {
    id: session.id,
    clientSecret: session.client_secret,
    status: session.status,
  }
}
