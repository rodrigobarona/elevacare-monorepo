/**
 * Browser-safe @eleva/billing/client entrypoint.
 *
 * Checkout Sessions payment for the public booking funnel. Server-only Stripe
 * SDK calls live in "@eleva/billing/server".
 */

export {
  BookingCheckoutPayment,
  type BookingCheckoutLabels,
  type BookingCheckoutOutcome,
} from "./checkout-payment"
export { elevaPaymentElementAppearance } from "./appearance"
