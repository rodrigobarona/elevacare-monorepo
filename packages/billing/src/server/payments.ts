import { randomUUID, timingSafeEqual } from "node:crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { env } from "@eleva/config/env"
import { CANCELLATION_POLICY_VERSION, PT_VAT_RATE_BPS } from "@eleva/config"
import { withAudit } from "@eleva/audit"
import {
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import type { ReservationFunnelSnapshot } from "@eleva/db/schema"
import {
  hashReservationToken,
  assertGuestEmailCanBook,
  assertMemberCanBook,
  BookingError,
  type MemberBookabilityError,
} from "@eleva/scheduling"
import { stripe } from "./client"
import {
  computeApplicationFee,
  computeSettlement,
  isClinicSaaS,
  type VatTreatment,
} from "./commission"
import {
  checkoutSessionIdempotencyKey,
  createBookingCheckoutSession,
  findOrCreateBookingCustomer,
  stripeObjectId,
} from "./booking-checkout-session"

export { hashReservationToken, checkoutSessionIdempotencyKey }

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
})

export function parseReservationFunnel(value: unknown) {
  return funnelSnapshotSchema.safeParse(value)
}

const bookingLinkIdSchema = z.string().uuid()

export function paymentIntentIdempotencyKey(reservationId: string): string {
  return checkoutSessionIdempotencyKey(reservationId)
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
  serviceName: string
  bookingId: string
  reservationId: string
  expertOrgId: string
  customerId: string
  returnUrl: string
  idempotencyKey: string
}

export async function createBookingPaymentIntent(
  input: CreateBookingPaymentIntentInput
): Promise<{
  id: string
  client_secret: string | null
  payment_intent: string | null
}> {
  return createBookingCheckoutSession(input)
}

export type CreatePaymentIntentForReservationInput = {
  reservationId: string
  reservationToken: string
  sessionUserId?: string
  returnUrl?: string
}

export type CreatePaymentIntentForReservationResult =
  | {
      ok: true
      clientSecret: string
      checkoutSessionId: string
      paymentIntentId: string | null
      bookingId: string
      publishableKey: string
    }
  | {
      ok: false
      error: "not_found" | "unavailable" | "db_error" | MemberBookabilityError
    }

export async function retrieveBookingPaymentIntent(
  paymentIntentId: string
): Promise<{
  id: string
  status: string
  amount: number
  currency: string
  metadata: {
    reservationId?: string
    bookingId?: string
    expertOrgId?: string
  }
  paymentMethodType?: string | null
}> {
  const intent = await stripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method"],
  })
  const method = intent.payment_method
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
  }
}

export async function createPaymentIntentForReservation(
  input: CreatePaymentIntentForReservationInput
): Promise<CreatePaymentIntentForReservationResult> {
  let loaded
  try {
    loaded = await loadReservationForIntent(input.reservationId)
  } catch (err) {
    console.error("[payments/intent] reservation load failed", err)
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
  if (currency.toUpperCase() !== "EUR") {
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
  if (!publishableKey) {
    return { ok: false, error: "unavailable" }
  }

  if (reservation.stripeCheckoutSessionId) {
    return reuseExistingCheckoutSession(
      reservation.stripeCheckoutSessionId,
      publishableKey
    )
  }

  if (!env().STRIPE_PMC_BOOKING) {
    return { ok: false, error: "unavailable" }
  }

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
    console.error("[payments/intent] booking/entitlements load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!reservation.userId && !funnel.guest?.email && !existing) {
    return { ok: false, error: "unavailable" }
  }
  let bookingId = existing?.bookingId ?? randomUUID()
  let paymentId = existing?.paymentId ?? randomUUID()
  const idempotencyKey = checkoutSessionIdempotencyKey(reservation.id)
  const returnUrl = input.returnUrl?.trim()
  if (!returnUrl) {
    return { ok: false, error: "unavailable" }
  }
  const guest = funnel.guest
  if (!guest?.email || !guest.name) {
    return { ok: false, error: "unavailable" }
  }
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

  if (!existing) {
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
            idempotencyKey,
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
        console.error("[payments/intent] tx A failed", err)
        return { ok: false, error: "db_error" }
      }
      bookingId = raced.bookingId
      paymentId = raced.paymentId
    }
  }

  let customerId: string
  let serviceName: string
  try {
    ;[customerId, serviceName] = await Promise.all([
      findOrCreateBookingCustomer({
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
      }),
      loadEventTypeName(reservation.orgId, reservation.eventTypeId),
    ])
  } catch (err) {
    console.error("[payments/intent] customer/offer load failed", err)
    return { ok: false, error: "unavailable" }
  }

  let session
  try {
    session = await createBookingPaymentIntent({
      amountCents: priceCents,
      serviceName,
      bookingId,
      reservationId: reservation.id,
      expertOrgId: reservation.orgId,
      customerId,
      returnUrl,
      idempotencyKey,
    })
  } catch (err) {
    console.error("[payments/intent] Stripe create failed", err)
    return { ok: false, error: "unavailable" }
  }

  if (!session.client_secret) {
    return { ok: false, error: "unavailable" }
  }

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        await bindCheckoutSession(tx, {
          reservationId: reservation.id,
          bookingId,
          checkoutSessionId: session.id,
          paymentIntentId: session.payment_intent,
          customerId,
        })
        await ctx.emit({
          entity: "booking_payment",
          action: "updated",
          entityId: paymentId,
          payload: {
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent,
            status: "requires_payment",
          },
        })
      }
    )
  } catch (err) {
    console.error("[payments/intent] tx B failed", err)
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    clientSecret: session.client_secret,
    checkoutSessionId: session.id,
    paymentIntentId: session.payment_intent,
    bookingId,
    publishableKey,
  }
}

async function reuseExistingCheckoutSession(
  checkoutSessionId: string,
  publishableKey: string
): Promise<CreatePaymentIntentForReservationResult> {
  try {
    const session = await stripe().checkout.sessions.retrieve(checkoutSessionId)
    const bookingId =
      session.metadata?.bookingId ?? session.metadata?.eleva_booking_id
    if (session.status !== "open" || !session.client_secret || !bookingId) {
      return { ok: false, error: "unavailable" }
    }
    return {
      ok: true,
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
      paymentIntentId: stripeObjectId(session.payment_intent),
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

async function loadEventTypeName(orgId: string, eventTypeId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({ title: main.eventTypes.title })
      .from(main.eventTypes)
      .where(eq(main.eventTypes.id, eventTypeId))
      .limit(1)
    return row?.title.en?.trim() || "Session"
  })
}

async function bindCheckoutSession(
  tx: Tx,
  input: {
    reservationId: string
    bookingId: string
    checkoutSessionId: string
    paymentIntentId: string | null
    customerId: string
  }
) {
  await tx
    .update(main.slotReservations)
    .set({
      stripeCheckoutSessionId: input.checkoutSessionId,
      ...(input.paymentIntentId
        ? { stripePaymentIntentId: input.paymentIntentId }
        : {}),
      funnel: sql`"funnel" - 'guest'`,
    })
    .where(eq(main.slotReservations.id, input.reservationId))
  await tx
    .update(main.bookings)
    .set({
      stripeCheckoutSessionId: input.checkoutSessionId,
      stripeCustomerId: input.customerId,
      ...(input.paymentIntentId
        ? { stripePaymentIntentId: input.paymentIntentId }
        : {}),
      status: "pending_payment",
    })
    .where(eq(main.bookings.id, input.bookingId))
  await tx
    .update(main.bookingPayments)
    .set({
      stripeCheckoutSessionId: input.checkoutSessionId,
      stripeCustomerId: input.customerId,
      ...(input.paymentIntentId
        ? { stripePaymentIntentId: input.paymentIntentId }
        : {}),
      status: "requires_payment",
    })
    .where(eq(main.bookingPayments.bookingId, input.bookingId))
}
