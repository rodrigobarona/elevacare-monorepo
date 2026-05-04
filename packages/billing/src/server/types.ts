/**
 * Server-side type contracts for @eleva/billing/server. Defined
 * separately so client wrappers can reference them without pulling
 * the Stripe SDK into the browser bundle.
 */

import type Stripe from "stripe"

export interface CreateConnectAccountInput {
  /** Eleva expert profile ID — used as `metadata.expert_profile_id`. */
  expertProfileId: string
  /** Eleva org ID — used as `metadata.org_id`. */
  orgId: string
  /** Login email for the Connect dashboard (must match expert account). */
  email: string
  /** ISO-3166-1 alpha-2 (defaults to 'PT' for v3 launch). */
  country?: string
  /** Default currency (defaults to 'eur'). */
  defaultCurrency?: string
  /** Locale hint for Stripe communications ('pt', 'en', 'es'). */
  preferredLocale?: string
}

/**
 * Component permission keys passed to AccountSession.create. We only
 * enable what each surface needs to keep the client secret narrow.
 *
 * Maps 1:1 to Stripe's `components.<name>` API. See
 * https://stripe.com/docs/connect/embedded-components/account-session.
 */
export type ConnectComponentName =
  | "account_onboarding"
  | "account_management"
  | "notification_banner"
  | "balances"
  | "payouts"
  | "payments"
  | "tax_settings"
  | "tax_registrations"

export interface CreateAccountSessionInput {
  /** The connected account this session targets (acct_*). */
  stripeAccountId: string
  /** Set of components that will be mounted under this session. */
  components: ConnectComponentName[]
}

export interface ConnectAccountSession {
  clientSecret: string
  expiresAt: number
}

export interface IdentityVerificationSession {
  /** vs_* identifier from Stripe Identity. */
  id: string
  /** Short-lived client secret used to mount the embedded modal. */
  clientSecret: string
  /** Status reported by Stripe at creation time. */
  status: Stripe.Identity.VerificationSession["status"]
}
