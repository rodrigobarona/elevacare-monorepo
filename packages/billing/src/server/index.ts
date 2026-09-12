/**
 * Server-only @eleva/billing entrypoint.
 *
 * Importing this from a Client Component will pull the Stripe Node
 * SDK into the bundle. Use "@eleva/billing/embedded" for browser
 * code.
 */
export { stripe, __resetStripeForTests } from "./client"
export {
  createConnectAccount,
  provisionConnectAccount,
  requestedConnectCapabilities,
  getConnectOnboardingState,
} from "./connect"
export {
  isConnectPublishReady,
  persistConnectStatus,
  persistIdentityStatus,
  snapshotFromAccount,
} from "./connect-status"
export {
  CONNECT_WEBHOOK_EVENTS,
  PLATFORM_WEBHOOK_EVENTS,
  WEBHOOK_EVENTS,
} from "./webhook-events"
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
export type { CancelPaymentIntentOutcome } from "./cancel-intents"
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
  computeApplicationFee,
  computeSettlement,
  isPriorityRanked,
  hasCRMAccess,
  isTopExpert,
  isClinicSaaS,
  ENTITLEMENT_KEYS,
  type BillingSession,
  type EntitlementKey,
  type BuyerKind,
  type CreditNoteAllocation,
  type SettlementResult,
  type VatTreatment,
} from "./commission"
export {
  createPayoutStateForPaidPayment,
  applyHold,
  clearHold,
  releaseHold,
  approvePayout,
  executeTransfer,
  markPayoutPaidOut,
  markPayoutFailedFromStripe,
  listPayouts,
  financeSummary,
  listFinanceBookings,
  listScheduledDuePayouts,
  promoteEligiblePendingPayouts,
  listUpcomingPayouts,
  isPayoutError,
  PayoutError,
} from "./payouts"
export {
  refundBookingPayment,
  applyDisputeOpened,
  applyDisputeClosed,
  confirmRefundFromCharge,
  confirmTransferReversed,
  markRefundFailedFromStripe,
  retryFailedTransferReversals,
  findBookingPaymentIdByCharge,
  isRefundError,
  RefundError,
} from "./refunds"
export {
  computeEligibleAt,
  needsPayoutApproval,
  payoutApprovalThresholdCents,
  evaluateRefundPolicy,
  cumulativeReversalCents,
  applyHoldSet,
  clearHoldSet,
  nextPayoutStatusAfterRefund,
  DEFAULT_PAYOUT_APPROVAL_THRESHOLD_CENTS,
  type PayoutStatus,
  type HoldReason,
} from "./payout-math"
export type {
  ConnectAccountSession,
  ConnectComponentName,
  CreateAccountSessionInput,
  CreateConnectAccountInput,
  IdentityVerificationSession,
} from "./types"
