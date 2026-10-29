import type Stripe from "stripe"
import type { BookingBillingAddress } from "@eleva/db/schema"
import { env } from "@eleva/config/env"
import { stripe } from "./client"

/**
 * Set on the session's PaymentIntent so confirm knows to read the session
 * (discount, NIF, billing address) without a lookup for plain intents.
 */
export const BOOKING_CHECKOUT_METADATA_MARKER = "elements"

/**
 * Session lifetime from the reservation's creation. Stripe requires 30 min
 * to 24 h from the session's own creation; sessions are only created while
 * the hold (5-10 min) is active, so 60 min from reserve always leaves more
 * than 30. The hold-expiry sweep expires the session long before this.
 */
export const CHECKOUT_SESSION_EXPIRES_SECONDS = 60 * 60

/**
 * One key per (hold, promotion code): changing the code builds a new
 * session, and retries of the same request stay idempotent.
 */
export function checkoutSessionIdempotencyKey(
  reservationId: string,
  promotionCodeId: string | null = null
): string {
  return promotionCodeId
    ? `cs:${reservationId}:${promotionCodeId}`
    : `cs:${reservationId}`
}

/** Metadata a Stripe promotion code (or its coupon) needs to work on bookings. */
export const BOOKING_PROMOTION_SCOPE = "booking"

export type BookingPromotionCodeResult =
  | { ok: true; promotionCodeId: string }
  | { ok: false; reason: "not_found" | "not_bookable" }

/**
 * Validates a member-typed code before it reaches a session. Only codes
 * Eleva marked for bookings (`metadata.eleva_scope = booking` on the
 * promotion code or its coupon) apply; never a 100%-off or non-EUR coupon
 * (a zero-total session has no PaymentIntent and cannot confirm), and never
 * a code meant for subscriptions.
 */
export async function resolveBookingPromotionCode(
  code: string
): Promise<BookingPromotionCodeResult> {
  const page = await stripe().promotionCodes.list({
    code: code.trim().toUpperCase(),
    active: true,
    limit: 1,
    expand: ["data.promotion.coupon"],
  })
  const promotion = page.data[0]
  if (!promotion) return { ok: false, reason: "not_found" }
  const coupon = promotionCoupon(promotion)
  const scoped =
    promotion.metadata?.eleva_scope === BOOKING_PROMOTION_SCOPE ||
    coupon?.metadata?.eleva_scope === BOOKING_PROMOTION_SCOPE
  if (!scoped || !coupon || !coupon.valid) {
    return { ok: false, reason: "not_bookable" }
  }
  if (coupon.percent_off != null && coupon.percent_off >= 100) {
    return { ok: false, reason: "not_bookable" }
  }
  if (
    coupon.amount_off != null &&
    (coupon.currency ?? "").toLowerCase() !== "eur"
  ) {
    return { ok: false, reason: "not_bookable" }
  }
  return { ok: true, promotionCodeId: promotion.id }
}

function promotionCoupon(
  promotion: Stripe.PromotionCode
): Stripe.Coupon | null {
  const withPromotion = promotion as Stripe.PromotionCode & {
    promotion?: { coupon?: Stripe.Coupon | string | null }
    coupon?: Stripe.Coupon | string | null
  }
  const coupon = withPromotion.promotion?.coupon ?? withPromotion.coupon
  return coupon && typeof coupon === "object" ? coupon : null
}

/**
 * Idempotent retries must resend identical parameters, so the expiry is
 * derived from the persisted reservation creation time, never from "now".
 */
export function checkoutSessionExpiresAt(reservationCreatedAt: Date): number {
  return (
    Math.floor(reservationCreatedAt.getTime() / 1000) +
    CHECKOUT_SESSION_EXPIRES_SECONDS
  )
}

export function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  return value.id
}

export type CreateBookingCheckoutSessionInput = {
  amountCents: number
  serviceName: string
  bookingId: string
  reservationId: string
  expertOrgId: string
  customerId: string
  returnUrl: string
  idempotencyKey: string
  /** Unix seconds from `checkoutSessionExpiresAt(reservation.createdAt)`. */
  expiresAt: number
  /** Validated by `resolveBookingPromotionCode`; Eleva-funded. */
  promotionCodeId?: string | null
}

/**
 * Paid booking Checkout Session (`ui_mode: "elements"`, decision log
 * 2026-10-13, flipped 2026-10-29).
 *
 * Eleva intermediates a healthcare service the expert sells and invoices,
 * so the session must not make Eleva look like the seller: no Stripe Tax
 * (`automatic_tax`; the session is VAT-exempt healthcare under CIVA art. 9
 * when due at all, and that is the expert's assessment) and no Stripe
 * invoice (`invoice_creation`; Portuguese invoices come from certified
 * software, Tier 2). Adaptive Pricing stays off for the EUR-only launch
 * (D-02) so the PaymentIntent amount is always the EUR session total.
 * Promotion codes are Eleva-funded (founder 2026-10-29) and validated by
 * `resolveBookingPromotionCode` before they reach the session. The member's NIF is
 * collected by Eleva's funnel, not Stripe tax ID collection: Stripe's tax ID
 * UI is business-oriented (business name, VIES VAT validation) and a private
 * member's NIF is not a VAT number.
 */
export async function createBookingCheckoutSession(
  input: CreateBookingCheckoutSessionInput
): Promise<{
  id: string
  client_secret: string | null
}> {
  const pmc = env().STRIPE_PMC_BOOKING
  if (!pmc) {
    throw new Error("STRIPE_PMC_BOOKING is not configured")
  }

  const metadata = {
    reservationId: input.reservationId,
    bookingId: input.bookingId,
    expertOrgId: input.expertOrgId,
    eleva_org_id: input.expertOrgId,
    eleva_booking_id: input.bookingId,
  }

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      ui_mode: "elements",
      return_url: input.returnUrl,
      customer: input.customerId,
      // Never `allow_promotion_codes`: it would accept any active code in
      // the account (subscription or 100%-off coupons included).
      ...(input.promotionCodeId
        ? { discounts: [{ promotion_code: input.promotionCodeId }] }
        : {}),
      billing_address_collection: "auto",
      expires_at: input.expiresAt,
      payment_method_configuration: pmc,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: input.amountCents,
            product_data: { name: input.serviceName },
          },
        },
      ],
      payment_intent_data: {
        transfer_group: input.bookingId,
        metadata: {
          ...metadata,
          eleva_checkout: BOOKING_CHECKOUT_METADATA_MARKER,
        },
      },
      metadata,
    },
    { idempotencyKey: input.idempotencyKey }
  )

  return {
    id: session.id,
    client_secret: session.client_secret,
  }
}

/** Finds the booking Checkout Session that created a PaymentIntent, if any. */
export async function retrieveBookingCheckoutForIntent(
  paymentIntentId: string
): Promise<BookingCheckoutSnapshot | null> {
  const page = await stripe().checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  })
  const session = page.data[0]
  if (!session || !isBookingPaymentCheckoutSession(session)) return null
  return bookingCheckoutSnapshotFromSession(session)
}

/** Retrieves a booking Checkout Session by id (public confirm path). */
export async function retrieveBookingCheckoutSession(
  checkoutSessionId: string
): Promise<BookingCheckoutSnapshot | null> {
  const session = await stripe().checkout.sessions.retrieve(checkoutSessionId)
  if (!isBookingPaymentCheckoutSession(session)) return null
  return bookingCheckoutSnapshotFromSession(session)
}

/**
 * Resolves the Stripe Customer for a booking. An email address does not
 * prove ownership, so a Customer is only reused when the caller passes the
 * id already bound to this buyer (e.g. stored on the signed-in member);
 * otherwise a new Customer is created, idempotent per reservation.
 */
export async function resolveBookingCustomer(input: {
  reservationId: string
  name: string
  email: string
  phone?: string
  boundCustomerId?: string | null
}): Promise<string> {
  if (input.boundCustomerId) return input.boundCustomerId

  const created = await stripe().customers.create(
    {
      name: input.name,
      email: input.email,
      ...(input.phone ? { phone: input.phone } : {}),
      metadata: {
        eleva_customer_kind: "booking",
        eleva_reservation_id: input.reservationId,
      },
    },
    { idempotencyKey: `cus:${input.reservationId}` }
  )
  return created.id
}

export type BookingCheckoutSnapshot = {
  checkoutSessionId: string
  customerId: string | null
  paymentIntentId: string | null
  bookingId: string | null
  reservationId: string | null
  orgId: string | null
  amountSubtotal: number | null
  amountTotal: number | null
  currency: string | null
  discountCents: number
  promotionCodeId: string | null
  taxId: string | null
  individualName: string | null
  businessName: string | null
  billingAddress: BookingBillingAddress | null
  presentmentCurrency: string | null
  presentmentAmountCents: number | null
}

type CheckoutCustomerDetails = NonNullable<
  Stripe.Checkout.Session["customer_details"]
> & {
  individual_name?: string | null
  business_name?: string | null
}

type CheckoutPresentment = {
  presentment_currency?: string | null
  presentment_amount?: number | null
}

function firstTaxId(
  details: CheckoutCustomerDetails | null | undefined
): string | null {
  const value = details?.tax_ids?.[0]?.value
  return typeof value === "string" && value.length > 0
    ? value.slice(0, 32)
    : null
}

function billingAddressFromSession(
  session: Stripe.Checkout.Session
): BookingBillingAddress | null {
  const details = session.customer_details
  const address = details?.address
  if (!address && !details?.name) return null
  return {
    name: details?.name ?? null,
    line1: address?.line1 ?? null,
    line2: address?.line2 ?? null,
    city: address?.city ?? null,
    state: address?.state ?? null,
    postalCode: address?.postal_code ?? null,
    country: address?.country ?? null,
  }
}

function promotionCodeIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const discounts = session.discounts
  if (!discounts || discounts.length === 0) return null
  const first = discounts[0]
  if (!first) return null
  if (typeof first.promotion_code === "string") return first.promotion_code
  if (first.promotion_code && typeof first.promotion_code === "object") {
    return first.promotion_code.id
  }
  return null
}

export function bookingCheckoutSnapshotFromSession(
  session: Stripe.Checkout.Session
): BookingCheckoutSnapshot {
  const details = session.customer_details as CheckoutCustomerDetails | null
  const presentment = session as Stripe.Checkout.Session & {
    presentment_details?: CheckoutPresentment | null
  }
  const presentmentDetails = presentment.presentment_details
  return {
    checkoutSessionId: session.id,
    customerId: stripeObjectId(session.customer),
    paymentIntentId: stripeObjectId(session.payment_intent),
    bookingId:
      session.metadata?.eleva_booking_id ?? session.metadata?.bookingId ?? null,
    reservationId:
      session.metadata?.reservationId ??
      session.metadata?.eleva_reservation_id ??
      null,
    orgId:
      session.metadata?.eleva_org_id ?? session.metadata?.expertOrgId ?? null,
    amountSubtotal: session.amount_subtotal,
    amountTotal: session.amount_total,
    currency: session.currency,
    discountCents: session.total_details?.amount_discount ?? 0,
    promotionCodeId: promotionCodeIdFromSession(session),
    taxId: firstTaxId(details),
    individualName: details?.individual_name ?? details?.name ?? null,
    businessName: details?.business_name ?? null,
    billingAddress: billingAddressFromSession(session),
    presentmentCurrency: presentmentDetails?.presentment_currency ?? null,
    presentmentAmountCents: presentmentDetails?.presentment_amount ?? null,
  }
}

export function isBookingPaymentCheckoutSession(
  session: Stripe.Checkout.Session
): boolean {
  return (
    session.mode === "payment" &&
    Boolean(session.metadata?.eleva_booking_id ?? session.metadata?.bookingId)
  )
}
