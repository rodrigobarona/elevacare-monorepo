import { and, eq, ne } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  lockMemberHealthConsentInvariant,
  main,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { hashReservationToken } from "./reservation-token"
import { timingSafeEqual } from "node:crypto"

const BOOKING_LINK_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export { hashReservationToken }

export type BookingPaymentIntentSnapshot = {
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
}

export type ConfirmBookingPaymentInput = {
  reservationId: string
  paymentIntentId: string
  source: "public" | "webhook"
  reservationToken?: string
  sessionUserId?: string
  retrieveIntent: (
    paymentIntentId: string
  ) => Promise<BookingPaymentIntentSnapshot>
}

export type ConfirmBookingPaymentResult =
  | { ok: true; alreadyConfirmed: boolean; bookingId: string; orgId: string }
  | {
      ok: false
      error: "not_found" | "payment_mismatch" | "unavailable" | "db_error"
    }

export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined
  }
  return false
}

function tokensMatch(storedHash: string, reservationToken: string): boolean {
  const computed = Buffer.from(hashReservationToken(reservationToken))
  const stored = Buffer.from(storedHash)
  return computed.length === stored.length && timingSafeEqual(computed, stored)
}

export function authorizeConfirmAccess(input: {
  capabilityHash: string
  reservationToken: string
  reservationUserId: string | null
  sessionUserId?: string
  status: string
  linkRevoked: boolean
  hasBoundIntent: boolean
}): "ok" | "not_found" {
  if (!tokensMatch(input.capabilityHash, input.reservationToken)) {
    return "not_found"
  }
  if (
    input.reservationUserId &&
    input.reservationUserId !== input.sessionUserId
  ) {
    return "not_found"
  }
  if (input.status !== "active" && input.status !== "converted") {
    return "not_found"
  }
  if (input.linkRevoked && !input.hasBoundIntent) {
    return "not_found"
  }
  return "ok"
}

function amountsMatch(
  intent: BookingPaymentIntentSnapshot,
  priceCents: number,
  currency: string
): boolean {
  return (
    intent.amount === priceCents &&
    intent.currency.toLowerCase() === currency.toLowerCase()
  )
}

export async function confirmBookingPayment(
  input: ConfirmBookingPaymentInput
): Promise<ConfirmBookingPaymentResult> {
  if (input.source === "public" && !input.reservationToken) {
    return { ok: false, error: "not_found" }
  }

  let loaded
  try {
    loaded = await loadConfirmTarget(input.reservationId, input.paymentIntentId)
  } catch (err) {
    console.error("[bookings/confirm] load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!loaded) return { ok: false, error: "not_found" }

  const { reservation, booking, payment, foreignPayment, linkRevoked } = loaded

  if (input.source === "public") {
    const access = authorizeConfirmAccess({
      capabilityHash: reservation.capabilityHash,
      reservationToken: input.reservationToken as string,
      reservationUserId: reservation.userId,
      sessionUserId: input.sessionUserId,
      status: reservation.status,
      linkRevoked,
      hasBoundIntent: Boolean(reservation.stripePaymentIntentId),
    })
    if (access === "not_found") return { ok: false, error: "not_found" }
  }

  let intent: BookingPaymentIntentSnapshot
  try {
    intent = await input.retrieveIntent(input.paymentIntentId)
  } catch (err) {
    console.error("[bookings/confirm] Stripe retrieve failed", err)
    return { ok: false, error: "unavailable" }
  }

  if (booking.status === "confirmed" && payment.status === "succeeded") {
    const sameIntent =
      payment.stripePaymentIntentId === input.paymentIntentId ||
      reservation.stripePaymentIntentId === input.paymentIntentId
    if (sameIntent) {
      return {
        ok: true,
        alreadyConfirmed: true,
        bookingId: booking.id,
        orgId: reservation.orgId,
      }
    }
    return { ok: false, error: "payment_mismatch" }
  }

  const metadataReservationId = intent.metadata.reservationId
  const mismatch =
    intent.status !== "succeeded" ||
    metadataReservationId !== input.reservationId ||
    reservation.priceCents == null ||
    !reservation.currency ||
    !amountsMatch(intent, reservation.priceCents, reservation.currency) ||
    Boolean(foreignPayment) ||
    (reservation.stripePaymentIntentId != null &&
      reservation.stripePaymentIntentId !== input.paymentIntentId) ||
    (booking.stripePaymentIntentId != null &&
      booking.stripePaymentIntentId !== input.paymentIntentId)

  if (mismatch) {
    try {
      await withAudit(
        { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
        async (_tx, ctx) => {
          await ctx.emit({
            entity: "booking_payment",
            action: "rejected",
            entityId: payment.id,
            payload: {
              code: "PAYMENT_MISMATCH",
              paymentIntentId: input.paymentIntentId,
              reservationId: input.reservationId,
              intentStatus: intent.status,
            },
          })
        }
      )
    } catch (err) {
      console.error("[bookings/confirm] mismatch audit failed", err)
    }
    return { ok: false, error: "payment_mismatch" }
  }

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        const memberId = booking.memberUserId ?? reservation.userId
        if (memberId) {
          await lockMemberHealthConsentInvariant(tx, memberId)
        }
        await flipConfirmed(tx, {
          reservationId: reservation.id,
          bookingId: booking.id,
          paymentId: payment.id,
          paymentIntentId: input.paymentIntentId,
          paymentMethodType: intent.paymentMethodType ?? null,
        })
        await emitGuestActivationRequired(tx, {
          orgId: reservation.orgId,
          bookingId: booking.id,
          reservationId: reservation.id,
        })
        await ctx.emit({
          entity: "booking",
          action: "confirmed",
          entityId: booking.id,
          payload: {
            reservationId: reservation.id,
            paymentIntentId: input.paymentIntentId,
          },
        })
      }
    )
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await loadConfirmTarget(
        input.reservationId,
        input.paymentIntentId
      )
      if (raced?.booking.status === "confirmed") {
        return {
          ok: true,
          alreadyConfirmed: true,
          bookingId: raced.booking.id,
          orgId: raced.reservation.orgId,
        }
      }
    }
    console.error("[bookings/confirm] flip failed", err)
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    alreadyConfirmed: false,
    bookingId: booking.id,
    orgId: reservation.orgId,
  }
}

export async function markBookingPaymentFailed(input: {
  paymentIntentId: string
  reservationId?: string
}): Promise<{ ok: true; bookingId?: string } | { ok: false }> {
  try {
    const loaded = input.reservationId
      ? await loadConfirmTarget(input.reservationId, input.paymentIntentId)
      : await loadByPaymentIntent(input.paymentIntentId)
    if (!loaded || loaded.booking.status === "confirmed") {
      return { ok: true, bookingId: loaded?.booking.id }
    }
    await withAudit(
      { orgId: loaded.reservation.orgId, actorUserId: null },
      async (tx, ctx) => {
        await tx
          .update(main.bookingPayments)
          .set({ status: "failed" })
          .where(eq(main.bookingPayments.id, loaded.payment.id))
        await ctx.emit({
          entity: "booking_payment",
          action: "failed",
          entityId: loaded.payment.id,
          payload: { paymentIntentId: input.paymentIntentId },
        })
      }
    )
    return { ok: true, bookingId: loaded.booking.id }
  } catch (err) {
    console.error("[bookings/confirm] payment_failed mark failed", err)
    return { ok: false }
  }
}

async function emitGuestActivationRequired(
  tx: Tx,
  input: {
    orgId: string
    bookingId: string
    reservationId: string
  }
) {
  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: "booking.guest_activation_required",
      payload: {
        bookingId: input.bookingId,
        reservationId: input.reservationId,
        hasGuest: true,
      },
      idempotencyKey: `booking:${input.bookingId}:guest-activation`,
    })
    .onConflictDoNothing({
      target: main.domainEventsOutbox.idempotencyKey,
    })
    .returning({ id: main.domainEventsOutbox.id })

  const eventId =
    inserted[0]?.id ??
    (
      await tx
        .select({ id: main.domainEventsOutbox.id })
        .from(main.domainEventsOutbox)
        .where(
          eq(
            main.domainEventsOutbox.idempotencyKey,
            `booking:${input.bookingId}:guest-activation`
          )
        )
        .limit(1)
    )[0]?.id
  if (!eventId) return

  await tx
    .insert(main.domainEventDeliveries)
    .values({
      orgId: input.orgId,
      eventId,
      subscriberId: "guest-activation",
      status: "pending",
    })
    .onConflictDoNothing()
}

async function flipConfirmed(
  tx: Tx,
  input: {
    reservationId: string
    bookingId: string
    paymentId: string
    paymentIntentId: string
    paymentMethodType: string | null
  }
) {
  const now = new Date()
  await tx
    .update(main.bookings)
    .set({
      status: "confirmed",
      confirmedAt: now,
      stripePaymentIntentId: input.paymentIntentId,
    })
    .where(eq(main.bookings.id, input.bookingId))
  await tx
    .update(main.bookingPayments)
    .set({
      status: "succeeded",
      stripePaymentIntentId: input.paymentIntentId,
      paymentMethodType: input.paymentMethodType,
      paidAt: now,
    })
    .where(eq(main.bookingPayments.id, input.paymentId))
  await tx
    .update(main.slotReservations)
    .set({
      status: "converted",
      bookingId: input.bookingId,
      stripePaymentIntentId: input.paymentIntentId,
    })
    .where(eq(main.slotReservations.id, input.reservationId))
}

async function loadConfirmTarget(
  reservationId: string,
  paymentIntentId: string
) {
  return withPlatformAdminContext(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(main.slotReservations)
      .where(eq(main.slotReservations.id, reservationId))
      .limit(1)
    if (!reservation) return null

    const [booking] = await tx
      .select()
      .from(main.bookings)
      .where(
        and(
          eq(main.bookings.orgId, reservation.orgId),
          eq(main.bookings.reservationId, reservation.id)
        )
      )
      .limit(1)
    if (!booking) return null

    const [payment] = await tx
      .select()
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.orgId, reservation.orgId),
          eq(main.bookingPayments.bookingId, booking.id)
        )
      )
      .limit(1)
    if (!payment) return null

    const [foreignPayment] = await tx
      .select({ id: main.bookingPayments.id })
      .from(main.bookingPayments)
      .where(
        and(
          eq(main.bookingPayments.stripePaymentIntentId, paymentIntentId),
          ne(main.bookingPayments.bookingId, booking.id)
        )
      )
      .limit(1)

    const rawLinkId =
      typeof reservation.funnel?.bookingLinkId === "string" &&
      BOOKING_LINK_ID_RE.test(reservation.funnel.bookingLinkId)
        ? reservation.funnel.bookingLinkId
        : null
    let linkRevoked = false
    if (rawLinkId) {
      const [link] = await tx
        .select({ revokedAt: main.bookingLinks.revokedAt })
        .from(main.bookingLinks)
        .where(
          and(
            eq(main.bookingLinks.id, rawLinkId),
            eq(main.bookingLinks.orgId, reservation.orgId)
          )
        )
        .limit(1)
      linkRevoked = Boolean(link?.revokedAt)
    }

    return { reservation, booking, payment, foreignPayment, linkRevoked }
  })
}

async function loadByPaymentIntent(paymentIntentId: string) {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select()
      .from(main.bookingPayments)
      .innerJoin(
        main.bookings,
        eq(main.bookings.id, main.bookingPayments.bookingId)
      )
      .innerJoin(
        main.slotReservations,
        eq(main.slotReservations.id, main.bookings.reservationId)
      )
      .where(eq(main.bookingPayments.stripePaymentIntentId, paymentIntentId))
      .limit(1)
    if (!row) return null
    return {
      payment: row.booking_payments,
      booking: row.bookings,
      reservation: row.slot_reservations,
      foreignPayment: null,
      linkRevoked: false,
    }
  })
}
