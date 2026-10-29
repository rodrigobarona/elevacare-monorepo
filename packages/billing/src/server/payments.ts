import { randomUUID, timingSafeEqual } from "node:crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import type Stripe from "stripe"
import { z } from "zod"
import { env } from "@eleva/config/env"
import { CANCELLATION_POLICY_VERSION, PT_VAT_RATE_BPS } from "@eleva/config"
import { pickLocalized } from "@eleva/config/i18n-locales"
import { withAudit } from "@eleva/audit"
import {
  auth as authSchema,
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import type { ReservationFunnelSnapshot } from "@eleva/db/schema"
import {
  type BookingCheckoutConfirmSnapshot,
  type BookingPaymentIntentSnapshot,
  hashReservationToken,
  assertGuestEmailCanBook,
  assertMemberCanBook,
  BookingError,
  type MemberBookabilityError,
} from "@eleva/scheduling"
import { stripe } from "./client"
import {
  STRIPE_ENV_METADATA_KEY,
  stripeEnvironmentTag,
} from "./stripe-environment"
import {
  BOOKING_CHECKOUT_METADATA_MARKER,
  bookingCheckoutSnapshotFromSession,
  resolveBookingPromotionCode,
  retrieveBookingCheckoutForIntent,
  type BookingCheckoutSnapshot,
  checkoutSessionExpiresAt,
  checkoutSessionIdempotencyKey,
  createBookingCheckoutSession,
  resolveBookingCustomer,
} from "./booking-checkout-session"
import {
  computeApplicationFee,
  computeSettlement,
  isClinicSaaS,
  type VatTreatment,
} from "./commission"

export { hashReservationToken }

const funnelSnapshotSchema = z.object({
  timezone: z.string().min(1),
  language: z.string().min(1),
  memberCountry: z
    .string()
    .length(2)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value)),
  bookingLinkId: z.string().uuid().nullable(),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  guest: z
    .object({
      email: z.string().email(),
      name: z.string().min(1),
      phone: z.string().optional(),
      taxId: z.string().min(8).max(32).optional(),
    })
    .optional(),
  promoCode: z.string().min(2).max(32).optional(),
  intakeNotesEncrypted: z.string().min(1).optional(),
  intakeNotes: z.string().max(8000).optional(),
})

export function parseReservationFunnel(value: unknown) {
  return funnelSnapshotSchema.safeParse(value)
}

const bookingLinkIdSchema = z.string().uuid()

export function paymentIntentIdempotencyKey(reservationId: string): string {
  return `pi:${reservationId}`
}

/**
 * A guest hold keeps its guest email even if the payer signs in later, so
 * both the session member and the reserved guest email must be bookable.
 */
export function reservationBookabilityTargets(input: {
  reservationUserId: string | null
  sessionUserId: string | null | undefined
  guestEmail: string | undefined
}): { memberId: string | null; guestEmail: string | undefined } {
  return {
    memberId: input.reservationUserId ?? input.sessionUserId ?? null,
    guestEmail: input.reservationUserId ? undefined : input.guestEmail,
  }
}

export function authorizeReservationAccess(input: {
  capabilityHash: string
  reservationToken: string
  reservationUserId: string | null
  sessionUserId?: string
  status: string
  expiresAt: Date
  linkRevoked: boolean
}): "ok" | "not_found" {
  const computed = Buffer.from(hashReservationToken(input.reservationToken))
  const stored = Buffer.from(input.capabilityHash)
  if (computed.length !== stored.length || !timingSafeEqual(computed, stored)) {
    return "not_found"
  }
  if (
    input.reservationUserId &&
    input.reservationUserId !== input.sessionUserId
  ) {
    return "not_found"
  }
  if (input.status !== "active") return "not_found"
  if (input.expiresAt.getTime() <= Date.now()) return "not_found"
  if (input.linkRevoked) return "not_found"
  return "ok"
}

export type CreateBookingPaymentIntentInput = {
  amountCents: number
  currency: string
  bookingId: string
  reservationId: string
  expertOrgId: string
  idempotencyKey: string
}

export async function createBookingPaymentIntent(
  input: CreateBookingPaymentIntentInput
): Promise<{ id: string; client_secret: string | null }> {
  const pmc = env().STRIPE_PMC_BOOKING
  if (!pmc) {
    throw new Error("STRIPE_PMC_BOOKING is not configured")
  }

  return stripe().paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      payment_method_configuration: pmc,
      transfer_group: input.bookingId,
      metadata: {
        reservationId: input.reservationId,
        bookingId: input.bookingId,
        expertOrgId: input.expertOrgId,
        eleva_org_id: input.expertOrgId,
        eleva_booking_id: input.bookingId,
        [STRIPE_ENV_METADATA_KEY]: stripeEnvironmentTag(),
      },
    },
    { idempotencyKey: input.idempotencyKey }
  )
}

export type CreatePaymentIntentForReservationInput = {
  reservationId: string
  reservationToken: string
  sessionUserId?: string
}

export type CreatePaymentIntentForReservationResult =
  | {
      ok: true
      clientSecret: string
      paymentIntentId: string
      bookingId: string
      publishableKey: string
    }
  | {
      ok: false
      error: "not_found" | "unavailable" | "db_error" | MemberBookabilityError
    }

export async function retrieveBookingPaymentIntent(
  paymentIntentId: string
): Promise<BookingPaymentIntentSnapshot> {
  const intent = await stripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method"],
  })
  const method = intent.payment_method
  const checkout =
    intent.metadata.eleva_checkout === BOOKING_CHECKOUT_METADATA_MARKER
      ? await retrieveBookingCheckoutForIntent(intent.id)
      : null
  return {
    id: intent.id,
    status: String(intent.status),
    amount: intent.amount,
    currency: intent.currency,
    metadata: {
      reservationId: intent.metadata.reservationId,
      bookingId: intent.metadata.bookingId,
      expertOrgId: intent.metadata.expertOrgId,
    },
    paymentMethodType:
      typeof method === "object" && method && "type" in method
        ? String(method.type)
        : null,
    ...(intent.metadata.eleva_checkout === BOOKING_CHECKOUT_METADATA_MARKER
      ? { checkout: checkout ? toConfirmCheckout(checkout) : null }
      : {}),
  }
}

function toConfirmCheckout(
  snapshot: BookingCheckoutSnapshot
): BookingCheckoutConfirmSnapshot {
  return {
    checkoutSessionId: snapshot.checkoutSessionId,
    amountSubtotal: snapshot.amountSubtotal,
    amountTotal: snapshot.amountTotal,
    currency: snapshot.currency,
    discountCents: snapshot.discountCents,
    promotionCodeId: snapshot.promotionCodeId,
    customerId: snapshot.customerId,
    taxId: snapshot.taxId,
    businessName: snapshot.businessName,
    billingAddress: snapshot.billingAddress,
  }
}

type PayableReservation = {
  reservation: typeof main.slotReservations.$inferSelect
  funnel: ReservationFunnelSnapshot
  priceCents: number
  currency: string
  publishableKey: string
}

type PrepareError = "not_found" | "unavailable" | MemberBookabilityError

/**
 * Shared gate for every paid-booking payment surface: capability token,
 * hold still active, funnel snapshot intact, member/guest bookable, Stripe
 * configured.
 */
async function preparePayableReservation(input: {
  reservationId: string
  reservationToken: string
  sessionUserId?: string
}): Promise<
  | ({ ok: true } & PayableReservation)
  | { ok: false; error: PrepareError | "db_error" }
> {
  let loaded
  try {
    loaded = await loadReservationForIntent(input.reservationId)
  } catch (err) {
    console.error("[payments] reservation load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!loaded) return { ok: false, error: "not_found" }

  const { reservation, linkRevoked } = loaded
  const access = authorizeReservationAccess({
    capabilityHash: reservation.capabilityHash,
    reservationToken: input.reservationToken,
    reservationUserId: reservation.userId,
    sessionUserId: input.sessionUserId,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    linkRevoked,
  })
  if (access === "not_found") {
    return { ok: false, error: "not_found" }
  }

  const parsedFunnel = parseReservationFunnel(reservation.funnel)
  const funnel: ReservationFunnelSnapshot | null = parsedFunnel.success
    ? parsedFunnel.data
    : null
  const priceCents = reservation.priceCents
  const currency = reservation.currency
  if (!funnel || priceCents == null || !currency) {
    return { ok: false, error: "unavailable" }
  }

  const { memberId, guestEmail } = reservationBookabilityTargets({
    reservationUserId: reservation.userId,
    sessionUserId: input.sessionUserId,
    guestEmail: funnel.guest?.email,
  })
  if (memberId || guestEmail) {
    try {
      if (memberId) await assertMemberCanBook(memberId)
      if (guestEmail) await assertGuestEmailCanBook(guestEmail)
    } catch (err) {
      if (err instanceof BookingError) {
        return { ok: false, error: err.code }
      }
      throw err
    }
  }

  const publishableKey = env().STRIPE_PUBLISHABLE_KEY
  if (!publishableKey || !env().STRIPE_PMC_BOOKING) {
    return { ok: false, error: "unavailable" }
  }

  return { ok: true, reservation, funnel, priceCents, currency, publishableKey }
}

/**
 * Tx A: insert the `pending_payment` booking and its payment row with the
 * commission computed on the list price (Eleva-funded promotion codes never
 * change the expert's share). Idempotent per reservation.
 */
async function ensurePendingBooking(
  payable: PayableReservation,
  input: { sessionUserId?: string; idempotencyKey: string }
): Promise<
  | { ok: true; bookingId: string; paymentId: string }
  | { ok: false; error: "unavailable" | "db_error" }
> {
  const { reservation, funnel, priceCents, currency } = payable
  let existing: Awaited<ReturnType<typeof loadBookingForReservation>>
  let entitlements: readonly string[]
  let billing: Awaited<ReturnType<typeof loadBillingSettlementFields>>
  try {
    ;[existing, entitlements, billing] = await Promise.all([
      loadBookingForReservation(reservation.orgId, reservation.id),
      loadOrgEntitlements(reservation.orgId),
      loadBillingSettlementFields(reservation.orgId),
    ])
  } catch (err) {
    console.error("[payments] booking/entitlements load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!reservation.userId && !funnel.guest?.email && !existing) {
    return { ok: false, error: "unavailable" }
  }
  if (existing) {
    return {
      ok: true,
      bookingId: existing.bookingId,
      paymentId: existing.paymentId,
    }
  }

  const bookingId = randomUUID()
  const paymentId = randomUUID()
  const buyerKind = isClinicSaaS({ entitlements }) ? "clinic" : "marketplace"
  const fee = computeApplicationFee({
    amountCents: priceCents,
    entitlements,
    buyerKind,
    commissionOverrideBps: billing?.commissionOverrideBps,
    commissionOverrideExpiresAt: billing?.commissionOverrideExpiresAt,
  })
  const settlement = computeSettlement({
    grossCents: priceCents,
    commissionBps: fee.commissionBps,
    vatRateBps: PT_VAT_RATE_BPS,
    vatTreatment: inferPlatformFeeVatTreatment(),
    processingFeeCents: 0,
    feeBearer: fee.feeBearer,
  })
  const applicationFeeCents = settlement.platformFeeGross
  const rate = fee.commissionBps / 10_000

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        await insertPendingBooking(tx, {
          bookingId,
          paymentId,
          reservation,
          funnel,
          priceCents,
          currency,
          applicationFeeCents,
          appliedCommissionBps: fee.commissionBps,
          platformFeeNetCents: settlement.platformFeeNet,
          platformFeeVatCents: settlement.vatOnPlatformFee,
          processingFeeCents: 0,
          idempotencyKey: input.idempotencyKey,
        })
        await ctx.emit({
          entity: "booking",
          action: "created",
          entityId: bookingId,
          payload: {
            reservationId: reservation.id,
            applicationFeeCents,
            commissionRate: rate,
          },
        })
      }
    )
  } catch (err) {
    const raced = await loadBookingForReservation(
      reservation.orgId,
      reservation.id
    )
    if (!raced) {
      console.error("[payments] tx A failed", err)
      return { ok: false, error: "db_error" }
    }
    return { ok: true, bookingId: raced.bookingId, paymentId: raced.paymentId }
  }
  return { ok: true, bookingId, paymentId }
}

export async function createPaymentIntentForReservation(
  input: CreatePaymentIntentForReservationInput
): Promise<CreatePaymentIntentForReservationResult> {
  const payable = await preparePayableReservation(input)
  if (!payable.ok) return payable
  const { reservation, priceCents, currency, publishableKey } = payable

  if (reservation.stripePaymentIntentId) {
    return reuseExistingIntent(
      reservation.stripePaymentIntentId,
      publishableKey
    )
  }
  // One payment surface per hold: never open a second charge path.
  if (reservation.stripeCheckoutSessionId) {
    return { ok: false, error: "unavailable" }
  }

  const idempotencyKey = paymentIntentIdempotencyKey(reservation.id)
  const pending = await ensurePendingBooking(payable, {
    sessionUserId: input.sessionUserId,
    idempotencyKey,
  })
  if (!pending.ok) return pending
  const { bookingId, paymentId } = pending

  let intent
  try {
    intent = await createBookingPaymentIntent({
      amountCents: priceCents,
      currency,
      bookingId,
      reservationId: reservation.id,
      expertOrgId: reservation.orgId,
      idempotencyKey,
    })
  } catch (err) {
    console.error("[payments/intent] Stripe create failed", err)
    return { ok: false, error: "unavailable" }
  }

  if (!intent.client_secret) {
    return { ok: false, error: "unavailable" }
  }

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        await bindPaymentIntent(tx, {
          reservationId: reservation.id,
          bookingId,
          paymentIntentId: intent.id,
        })
        await ctx.emit({
          entity: "booking_payment",
          action: "updated",
          entityId: paymentId,
          payload: { paymentIntentId: intent.id, status: "requires_payment" },
        })
      }
    )
  } catch (err) {
    console.error("[payments/intent] tx B failed", err)
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    bookingId,
    publishableKey,
  }
}

export type CreateCheckoutSessionForReservationInput = {
  reservationId: string
  reservationToken: string
  sessionUserId?: string
  /** Absolute URL on the Eleva gateway, built and validated by the route. */
  returnUrl: string
  /** Member-typed promotion code; validated before it reaches Stripe. */
  promoCode?: string
}

export type CreateCheckoutSessionForReservationResult =
  | {
      ok: true
      clientSecret: string
      checkoutSessionId: string
      bookingId: string
      publishableKey: string
    }
  | {
      ok: false
      error:
        | "not_found"
        | "unavailable"
        | "db_error"
        | "promo_invalid"
        | MemberBookabilityError
    }

/**
 * Paid booking via Checkout Sessions (`ui_mode: "elements"`). Same
 * commit-intent / vendor call / bind pattern as the PaymentIntent path:
 * tx A inserts the pending booking, Stripe is called outside any
 * transaction, tx B binds the session id. A different promotion code
 * replaces the open session (expire, then create and rebind).
 */
export async function createCheckoutSessionForReservation(
  input: CreateCheckoutSessionForReservationInput
): Promise<CreateCheckoutSessionForReservationResult> {
  const payable = await preparePayableReservation(input)
  if (!payable.ok) return payable
  const { reservation, funnel, currency } = payable
  if (currency.toLowerCase() !== "eur") {
    return { ok: false, error: "unavailable" }
  }
  if (reservation.stripePaymentIntentId) {
    return { ok: false, error: "unavailable" }
  }

  let promotionCodeId: string | null = null
  if (input.promoCode) {
    try {
      const promo = await resolveBookingPromotionCode(
        input.promoCode,
        payable.priceCents
      )
      if (!promo.ok) return { ok: false, error: "promo_invalid" }
      promotionCodeId = promo.promotionCodeId
    } catch (err) {
      console.error("[payments/checkout-session] promotion lookup failed", err)
      return { ok: false, error: "unavailable" }
    }
  }

  if (reservation.stripeCheckoutSessionId) {
    return replaceOrReuseCheckoutSession({
      payable,
      sessionUserId: input.sessionUserId,
      returnUrl: input.returnUrl,
      promotionCodeId,
    })
  }

  const idempotencyKey = checkoutSessionIdempotencyKey(reservation.id)
  const pending = await ensurePendingBooking(payable, {
    sessionUserId: input.sessionUserId,
    idempotencyKey,
  })
  if (!pending.ok) return pending

  let buyer: { name: string; email: string; phone?: string } | null
  try {
    buyer = await loadBuyerContact(
      reservation.userId ?? input.sessionUserId,
      funnel
    )
  } catch (err) {
    console.error("[payments/checkout-session] buyer load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!buyer) return { ok: false, error: "unavailable" }

  let customerId: string
  try {
    customerId = await resolveBookingCustomer({
      reservationId: reservation.id,
      ...buyer,
    })
  } catch (err) {
    console.error("[payments/checkout-session] customer failed", err)
    return { ok: false, error: "unavailable" }
  }

  return createAndBindCheckoutSession({
    payable,
    bookingId: pending.bookingId,
    paymentId: pending.paymentId,
    customerId,
    promotionCodeId,
    idempotencyKey: checkoutSessionIdempotencyKey(
      reservation.id,
      promotionCodeId
    ),
    returnUrl: input.returnUrl,
    sessionUserId: input.sessionUserId,
  })
}

async function replaceOrReuseCheckoutSession(input: {
  payable: PayableReservation
  sessionUserId?: string
  returnUrl: string
  promotionCodeId: string | null
}): Promise<CreateCheckoutSessionForReservationResult> {
  const { reservation, publishableKey } = input.payable
  const previousId = reservation.stripeCheckoutSessionId as string
  let previous: Stripe.Checkout.Session
  try {
    previous = await stripe().checkout.sessions.retrieve(previousId)
  } catch {
    return { ok: false, error: "unavailable" }
  }
  const previousSnapshot = bookingCheckoutSnapshotFromSession(previous)
  const bookingId = previousSnapshot.bookingId
  const isOpen = previous.status === "open"
  if ((!isOpen && previous.status !== "expired") || !bookingId) {
    return { ok: false, error: "unavailable" }
  }
  if (isOpen && previousSnapshot.promotionCodeId === input.promotionCodeId) {
    if (!previous.client_secret) return { ok: false, error: "unavailable" }
    return {
      ok: true,
      clientSecret: previous.client_secret,
      checkoutSessionId: previous.id,
      bookingId,
      publishableKey,
    }
  }

  const customerId = previousSnapshot.customerId
  let existing: Awaited<ReturnType<typeof loadBookingForReservation>>
  try {
    existing = await loadBookingForReservation(
      reservation.orgId,
      reservation.id
    )
  } catch {
    return { ok: false, error: "db_error" }
  }
  if (!customerId || !existing) return { ok: false, error: "unavailable" }

  if (isOpen) {
    try {
      // Close the old session first so only one can ever be paid.
      await stripe().checkout.sessions.expire(previousId)
    } catch (err) {
      console.error("[payments/checkout-session] expire previous failed", err)
      return { ok: false, error: "unavailable" }
    }
  }

  return createAndBindCheckoutSession({
    payable: input.payable,
    bookingId: existing.bookingId,
    paymentId: existing.paymentId,
    customerId,
    promotionCodeId: input.promotionCodeId,
    // Unique per transition, stable for retries of the same transition.
    idempotencyKey: `cs:${reservation.id}:${previousId}:${input.promotionCodeId ?? "none"}`,
    returnUrl: input.returnUrl,
    sessionUserId: input.sessionUserId,
  })
}

async function createAndBindCheckoutSession(input: {
  payable: PayableReservation
  bookingId: string
  paymentId: string
  customerId: string
  promotionCodeId: string | null
  idempotencyKey: string
  returnUrl: string
  sessionUserId?: string
}): Promise<CreateCheckoutSessionForReservationResult> {
  const { reservation, funnel, priceCents, publishableKey } = input.payable
  let serviceName: string
  try {
    serviceName = await loadServiceName(
      reservation.orgId,
      reservation.eventTypeId,
      funnel.language
    )
  } catch (err) {
    console.error("[payments/checkout-session] service load failed", err)
    return { ok: false, error: "db_error" }
  }

  let session
  try {
    session = await createBookingCheckoutSession({
      amountCents: priceCents,
      serviceName,
      bookingId: input.bookingId,
      reservationId: reservation.id,
      expertOrgId: reservation.orgId,
      customerId: input.customerId,
      returnUrl: input.returnUrl,
      idempotencyKey: input.idempotencyKey,
      expiresAt: checkoutSessionExpiresAt(reservation.createdAt),
      promotionCodeId: input.promotionCodeId,
    })
  } catch (err) {
    console.error("[payments/checkout-session] Stripe create failed", err)
    return { ok: false, error: "unavailable" }
  }
  const clientSecret = session.client_secret
  if (!clientSecret) return { ok: false, error: "unavailable" }

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        await bindCheckoutSession(tx, {
          reservationId: reservation.id,
          bookingId: input.bookingId,
          checkoutSessionId: session.id,
          customerId: input.customerId,
        })
        await ctx.emit({
          entity: "booking_payment",
          action: "updated",
          entityId: input.paymentId,
          payload: {
            checkoutSessionId: session.id,
            promotionCodeId: input.promotionCodeId,
            status: "requires_payment",
          },
        })
      }
    )
  } catch (err) {
    console.error("[payments/checkout-session] tx B failed", err)
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    clientSecret,
    checkoutSessionId: session.id,
    bookingId: input.bookingId,
    publishableKey,
  }
}

/** Guest contact from the funnel, or the signed-in member's account row. */
async function loadBuyerContact(
  userId: string | null | undefined,
  funnel: ReservationFunnelSnapshot
): Promise<{ name: string; email: string; phone?: string } | null> {
  if (funnel.guest) {
    return {
      name: funnel.guest.name,
      email: funnel.guest.email,
      ...(funnel.guest.phone ? { phone: funnel.guest.phone } : {}),
    }
  }
  if (!userId) return null
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ name: authSchema.user.name, email: authSchema.user.email })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1)
    return row ? { name: row.name, email: row.email } : null
  })
}

async function loadServiceName(
  orgId: string,
  eventTypeId: string,
  locale: string
): Promise<string> {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({ title: main.eventTypes.title })
      .from(main.eventTypes)
      .where(eq(main.eventTypes.id, eventTypeId))
      .limit(1)
    const name = row ? pickLocalized(row.title, locale).trim() : ""
    return name.length > 0 ? name.slice(0, 250) : "Eleva session"
  })
}

async function reuseExistingIntent(
  paymentIntentId: string,
  publishableKey: string
): Promise<CreatePaymentIntentForReservationResult> {
  try {
    const intent = await stripe().paymentIntents.retrieve(paymentIntentId)
    const bookingId = intent.metadata.bookingId
    const reusable =
      intent.status === "requires_payment_method" ||
      intent.status === "requires_confirmation" ||
      intent.status === "requires_action" ||
      intent.status === "processing"
    if (!intent.client_secret || !bookingId || !reusable) {
      return { ok: false, error: "unavailable" }
    }
    return {
      ok: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      bookingId,
      publishableKey,
    }
  } catch {
    return { ok: false, error: "unavailable" }
  }
}

async function loadReservationForIntent(reservationId: string) {
  return withPlatformAdminContext(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(main.slotReservations)
      .where(eq(main.slotReservations.id, reservationId))
      .limit(1)

    if (!reservation) return null

    const rawLinkId = reservation.funnel?.bookingLinkId
    const bookingLinkId = bookingLinkIdSchema.safeParse(rawLinkId).success
      ? rawLinkId
      : null
    let linkRevoked = false
    if (bookingLinkId) {
      const [link] = await tx
        .select({ revokedAt: main.bookingLinks.revokedAt })
        .from(main.bookingLinks)
        .where(
          and(
            eq(main.bookingLinks.id, bookingLinkId),
            eq(main.bookingLinks.orgId, reservation.orgId)
          )
        )
        .limit(1)
      linkRevoked = Boolean(link?.revokedAt)
    }

    return {
      reservation,
      linkRevoked,
    }
  })
}

const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const

/**
 * Working pre-launch VAT treatment for the platform fee (D-03).
 * Phase 7 IVA matrix is SSOT (expert country + VAT-ID). Until then
 * Portugal-first launch bills the fee to PT experts as PT B2B.
 * Do not infer from the member's country.
 */
function inferPlatformFeeVatTreatment(): VatTreatment {
  return "pt_b2b"
}

async function loadBillingSettlementFields(orgId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({
        commissionOverrideBps: main.billingCustomers.commissionOverrideBps,
        commissionOverrideExpiresAt:
          main.billingCustomers.commissionOverrideExpiresAt,
      })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, orgId))
      .limit(1)
    return row ?? null
  })
}

async function loadOrgEntitlements(orgId: string): Promise<readonly string[]> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select({ tier: main.billingSubscriptions.tier })
      .from(main.billingSubscriptions)
      .where(
        and(
          eq(main.billingSubscriptions.orgId, orgId),
          inArray(
            main.billingSubscriptions.status,
            ENTITLED_SUBSCRIPTION_STATUSES
          )
        )
      )
    const entitlements = new Set<string>()
    for (const row of rows) {
      if (row.tier && row.tier !== "unknown") {
        entitlements.add(row.tier)
      }
    }
    return [...entitlements]
  })
}

async function loadBookingForReservation(orgId: string, reservationId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({
        bookingId: main.bookings.id,
        paymentId: main.bookingPayments.id,
      })
      .from(main.bookings)
      .innerJoin(
        main.bookingPayments,
        eq(main.bookingPayments.bookingId, main.bookings.id)
      )
      .where(
        and(
          eq(main.bookings.orgId, orgId),
          eq(main.bookings.reservationId, reservationId)
        )
      )
      .limit(1)
    return row ?? null
  })
}

async function loadEventTypeCancellationPolicy(tx: Tx, eventTypeId: string) {
  const [eventType] = await tx
    .select({ cancellationPolicy: main.eventTypes.cancellationPolicy })
    .from(main.eventTypes)
    .where(eq(main.eventTypes.id, eventTypeId))
    .limit(1)
  if (!eventType) {
    throw new Error(`event type ${eventTypeId} not found`)
  }
  return eventType.cancellationPolicy
}

async function insertPendingBooking(
  tx: Tx,
  input: {
    bookingId: string
    paymentId: string
    reservation: typeof main.slotReservations.$inferSelect
    funnel: z.infer<typeof funnelSnapshotSchema>
    priceCents: number
    currency: string
    applicationFeeCents: number
    appliedCommissionBps: number
    platformFeeNetCents: number
    platformFeeVatCents: number
    processingFeeCents: number
    idempotencyKey: string
  }
) {
  const { reservation, funnel } = input
  const cancellationPolicy =
    reservation.cancellationPolicy ??
    (await loadEventTypeCancellationPolicy(tx, reservation.eventTypeId))
  await tx.insert(main.bookings).values({
    id: input.bookingId,
    orgId: reservation.orgId,
    eventTypeId: reservation.eventTypeId,
    expertProfileId: reservation.expertProfileId,
    expertUserId: reservation.expertUserId,
    reservationId: reservation.id,
    memberUserId: reservation.userId,
    guestEmail: funnel.guest?.email,
    guestName: funnel.guest?.name,
    guestPhone: funnel.guest?.phone,
    buyerTaxId: funnel.guest?.taxId,
    eventTypeModeId: reservation.eventTypeModeId,
    language: funnel.language,
    memberCountry: funnel.memberCountry,
    bookingLinkId: funnel.bookingLinkId,
    priceCents: input.priceCents,
    priceAmount: input.priceCents,
    currency: input.currency,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    timezone: funnel.timezone,
    status: "pending_payment",
    sessionMode: funnel.sessionMode,
    bookedLocale: funnel.language,
    cancellationPolicy,
    cancellationPolicyVersion: CANCELLATION_POLICY_VERSION,
    requiresApproval: reservation.requiresApproval,
  })
  await tx.insert(main.bookingPayments).values({
    id: input.paymentId,
    orgId: reservation.orgId,
    bookingId: input.bookingId,
    status: "intent_pending",
    amountCents: input.priceCents,
    applicationFeeCents: input.applicationFeeCents,
    appliedCommissionBps: input.appliedCommissionBps,
    platformFeeNetCents: input.platformFeeNetCents,
    platformFeeVatCents: input.platformFeeVatCents,
    processingFeeCents: input.processingFeeCents,
    transferGroup: input.bookingId,
    stripeIdempotencyKey: input.idempotencyKey,
  })
}

async function bindPaymentIntent(
  tx: Tx,
  input: {
    reservationId: string
    bookingId: string
    paymentIntentId: string
  }
) {
  await tx
    .update(main.slotReservations)
    .set({
      stripePaymentIntentId: input.paymentIntentId,
      funnel: sql`"funnel" - 'guest'`,
    })
    .where(eq(main.slotReservations.id, input.reservationId))
  await tx
    .update(main.bookings)
    .set({
      stripePaymentIntentId: input.paymentIntentId,
      status: "pending_payment",
    })
    .where(eq(main.bookings.id, input.bookingId))
  await tx
    .update(main.bookingPayments)
    .set({
      stripePaymentIntentId: input.paymentIntentId,
      status: "requires_payment",
    })
    .where(eq(main.bookingPayments.bookingId, input.bookingId))
}

async function bindCheckoutSession(
  tx: Tx,
  input: {
    reservationId: string
    bookingId: string
    checkoutSessionId: string
    customerId: string
  }
) {
  await tx
    .update(main.slotReservations)
    .set({
      stripeCheckoutSessionId: input.checkoutSessionId,
      funnel: sql`"funnel" - 'guest'`,
    })
    .where(eq(main.slotReservations.id, input.reservationId))
  await tx
    .update(main.bookings)
    .set({
      stripeCheckoutSessionId: input.checkoutSessionId,
      stripeCustomerId: input.customerId,
      status: "pending_payment",
    })
    .where(eq(main.bookings.id, input.bookingId))
  await tx
    .update(main.bookingPayments)
    .set({
      stripeCheckoutSessionId: input.checkoutSessionId,
      stripeCustomerId: input.customerId,
      status: "requires_payment",
    })
    .where(eq(main.bookingPayments.bookingId, input.bookingId))
}
