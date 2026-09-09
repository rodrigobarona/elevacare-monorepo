export const BOOKING_PAYMENT_METHOD_CLASSES = [
  "synchronous",
  "async_short",
  "excluded",
] as const

export type BookingPaymentMethodClass =
  (typeof BOOKING_PAYMENT_METHOD_CLASSES)[number]

const SYNCHRONOUS = new Set(["card", "link", "apple_pay", "google_pay"])
const ASYNC_SHORT = new Set(["mb_way"])

export function classifyPaymentMethod(
  paymentMethodType: string
): BookingPaymentMethodClass {
  if (SYNCHRONOUS.has(paymentMethodType)) return "synchronous"
  if (ASYNC_SHORT.has(paymentMethodType)) return "async_short"
  return "excluded"
}
