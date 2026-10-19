import type Stripe from "stripe"
import type { BookingBillingAddress } from "@eleva/db/schema"
import { env } from "@eleva/config/env"
import { stripe } from "./client"

/** Stripe's Checkout Session minimum expiry is 30 minutes. */
export const CHECKOUT_SESSION_EXPIRES_SECONDS = 31 * 60

export function checkoutSessionIdempotencyKey(reservationId: string): string {
  return `cs:${reservationId}`
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
}

export async function createBookingCheckoutSession(
  input: CreateBookingCheckoutSessionInput
): Promise<{
  id: string
  client_secret: string | null
  payment_intent: string | null
}> {
  const pmc = env().STRIPE_PMC_BOOKING
  if (!pmc) {
    throw new Error("STRIPE_PMC_BOOKING is not configured")
  }

  const expiresAt =
    Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_EXPIRES_SECONDS
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
      adaptive_pricing: { enabled: true },
      automatic_tax: { enabled: true },
      invoice_creation: { enabled: true },
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      name_collection: {
        individual: { enabled: true },
        business: { enabled: true, optional: true },
      },
      billing_address_collection: "required",
      expires_at: expiresAt,
      payment_method_configuration: pmc,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: input.amountCents,
            tax_behavior: "inclusive",
            product_data: { name: input.serviceName },
          },
        },
      ],
      payment_intent_data: {
        transfer_group: input.bookingId,
        metadata,
      },
      metadata,
    },
    { idempotencyKey: input.idempotencyKey }
  )

  return {
    id: session.id,
    client_secret: session.client_secret,
    payment_intent: stripeObjectId(session.payment_intent),
  }
}

export async function findOrCreateBookingCustomer(input: {
  name: string
  email: string
  phone?: string
}): Promise<string> {
  const listed = await stripe().customers.list({
    email: input.email,
    limit: 10,
  })
  const existing = listed.data.find(
    (customer) => !customer.deleted && !customer.metadata?.eleva_org_id
  )
  if (existing) {
    await stripe().customers.update(existing.id, {
      name: input.name,
      ...(input.phone ? { phone: input.phone } : {}),
    })
    return existing.id
  }

  const created = await stripe().customers.create({
    name: input.name,
    email: input.email,
    ...(input.phone ? { phone: input.phone } : {}),
    metadata: { eleva_customer_kind: "booking" },
  })
  return created.id
}

export type BookingCheckoutSnapshot = {
  checkoutSessionId: string
  customerId: string | null
  paymentIntentId: string | null
  bookingId: string | null
  reservationId: string | null
  orgId: string | null
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
