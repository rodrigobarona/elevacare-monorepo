/**
 * Browser-safe @eleva/billing/client entrypoint.
 *
 * Payment Element for the public booking funnel. Server-only Stripe
 * SDK calls live in "@eleva/billing/server".
 */

export {
  BookingPaymentElement,
  type BookingPaymentResult,
} from "./payment-element"
export { elevaPaymentElementAppearance } from "./appearance"
