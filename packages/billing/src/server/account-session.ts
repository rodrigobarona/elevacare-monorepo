import { stripe } from "./client"
import type {
  ConnectAccountSession,
  ConnectComponentName,
  CreateAccountSessionInput,
} from "./types"

/**
 * Mint a Stripe AccountSession scoped to a connected account and a
 * narrow set of embedded components.
 *
 * Caller MUST gate this behind RBAC: only the expert who owns the
 * account (or an admin with `payouts:approve` / equivalent) should
 * receive a client secret. The component permission set is derived
 * from the page mounting the components — never grant more than the
 * surface needs.
 *
 * Returned `client_secret` is short-lived (~1 hour). The browser
 * passes it to `<ConnectComponentsProvider>` which manages refresh
 * automatically while the page is open.
 *
 * Reference:
 * https://stripe.com/docs/connect/embedded-components/account-session
 */
export async function createAccountSession(
  input: CreateAccountSessionInput
): Promise<ConnectAccountSession> {
  if (input.components.length === 0) {
    throw new Error("createAccountSession: components[] cannot be empty")
  }

  const components = buildComponentMap(input.components)

  const session = await stripe().accountSessions.create({
    account: input.stripeAccountId,
    components,
  })

  return {
    clientSecret: session.client_secret,
    expiresAt: session.expires_at,
  }
}

/**
 * Map our typed component names to Stripe's `components.<name>`
 * payload with the minimum-necessary feature flags per surface.
 *
 * Update this table when adding a new surface to the expert
 * workspace; payments-payouts-spec.md tracks which permissions each
 * embedded component needs.
 */
function buildComponentMap(
  components: ConnectComponentName[]
): Record<string, { enabled: boolean; features?: Record<string, unknown> }> {
  const out: Record<
    string,
    { enabled: boolean; features?: Record<string, unknown> }
  > = {}

  for (const name of components) {
    switch (name) {
      case "account_onboarding":
        out.account_onboarding = { enabled: true }
        break
      case "account_management":
        out.account_management = {
          enabled: true,
          features: { external_account_collection: true },
        }
        break
      case "notification_banner":
        out.notification_banner = {
          enabled: true,
          features: { external_account_collection: true },
        }
        break
      case "balances":
        out.balances = {
          enabled: true,
          features: { instant_payouts: false, standard_payouts: true },
        }
        break
      case "payouts":
        out.payouts = {
          enabled: true,
          features: {
            instant_payouts: false,
            standard_payouts: true,
            edit_payout_schedule: true,
          },
        }
        break
      case "payments":
        out.payments = {
          enabled: true,
          features: {
            refund_management: true,
            dispute_management: true,
            capture_payments: true,
          },
        }
        break
      case "tax_settings":
        out.tax_settings = { enabled: true }
        break
      case "tax_registrations":
        out.tax_registrations = { enabled: true }
        break
      default: {
        const _exhaustive: never = name
        throw new Error(`Unknown Connect component: ${String(_exhaustive)}`)
      }
    }
  }

  return out
}
