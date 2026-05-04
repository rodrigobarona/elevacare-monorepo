/**
 * Server-only @eleva/billing entrypoint.
 *
 * Importing this from a Client Component will pull the Stripe Node
 * SDK into the bundle. Use "@eleva/billing/embedded" for browser
 * code.
 */
export { stripe, __resetStripeForTests } from "./client"
export { createConnectAccount } from "./connect"
export { createAccountSession } from "./account-session"
export { createIdentityVerificationSession } from "./identity"
export type {
  ConnectAccountSession,
  ConnectComponentName,
  CreateAccountSessionInput,
  CreateConnectAccountInput,
  IdentityVerificationSession,
} from "./types"
