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
  createSubscriptionCheckoutSession,
  createBillingPortalSession,
  getBillingCustomerForOrg,
  swapSubscriptionTier,
  findTierPrice,
  PRODUCT_KEYS,
} from "./subscriptions"
export type { ProductTier } from "./subscriptions"
export { provisionOrgBilling } from "./provisioning"
export {
  enqueueSeatSync,
  markSeatSyncPending,
  syncSeatQuantity,
  syncSeatQuantityAudited,
} from "./seats"
export type { SyncSeatQuantityResult } from "./seats"
export type {
  ProvisionBillingInput,
  ProvisionBillingResult,
} from "./provisioning"
export { processStripeEvent, TerminalError } from "./webhook"
export {
  createPaymentIntentForReservation,
  retrieveBookingPaymentIntent,
} from "./payments"
export type { CreatePaymentIntentForReservationResult } from "./payments"
export { cancelCancelablePaymentIntents } from "./cancel-intents"
export { retrieveChargeReceipt } from "./receipts"
export type { ChargeReceipt } from "./receipts"
export { listMemberPaymentsWithReceipts } from "./member-payments"
export {
  classifyPaymentMethod,
  type BookingPaymentMethodClass,
} from "./payment-method-policy"
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
