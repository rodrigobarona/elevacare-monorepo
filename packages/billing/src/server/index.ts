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
export {
  createOrgCustomer,
  createOrgSubscription,
  swapSubscriptionTier,
  findTierPrice,
  PRODUCT_KEYS,
} from "./subscriptions"
export type { ProductTier } from "./subscriptions"
export { provisionOrgBilling } from "./provisioning"
export type {
  ProvisionBillingInput,
  ProvisionBillingResult,
} from "./provisioning"
export { processStripeEvent } from "./webhook"
export type { StripeEventResult } from "./webhook"
export {
  computeCommissionRate,
  isPriorityRanked,
  hasCRMAccess,
  isTopExpert,
  isClinicSaaS,
  ENTITLEMENT_KEYS,
  type BillingSession,
  type EntitlementKey,
} from "./commission"
export type {
  ConnectAccountSession,
  ConnectComponentName,
  CreateAccountSessionInput,
  CreateConnectAccountInput,
  IdentityVerificationSession,
} from "./types"
