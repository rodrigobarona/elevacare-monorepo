import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { CANCELLATION_POLICY_VERSION } from "@eleva/config"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import {
  authorizeConfirmAccess,
  isUniqueViolation,
  type ConfirmBookingPaymentResult,
} from "./confirm-booking"
import { emitBookingNotificationEvent } from "./emit-domain-event"
import { ensureSessionRow } from "./ensure-session-row"

const BOOKING_LINK_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function confirmFreeReservation(input: {
  reservationId: string
  reservationToken: string
  sessionUserId?: string
}): Promise<ConfirmBookingPaymentResult> {
  if (!input.reservationToken) {
    return { ok: false, error: "not_found" }
  }

  let loaded
  try {
    loaded = await loadFreeConfirmTarget(input.reservationId)
  } catch (err) {
    console.error("[bookings/confirm-free] load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!loaded) return { ok: false, error: "not_found" }

  const { reservation, booking, payment, linkRevoked } = loaded
  const access = authorizeConfirmAccess({
    capabilityHash: reservation.capabilityHash,
    reservationToken: input.reservationToken,
    reservationUserId: reservation.userId,
    sessionUserId: input.sessionUserId,
    status: reservation.status,
    linkRevoked,
    hasBoundIntent: Boolean(reservation.stripePaymentIntentId),
  })
  if (access === "not_found") return { ok: false, error: "not_found" }

  if (reservation.priceCents !== 0 || reservation.stripePaymentIntentId) {
    return { ok: false, error: "not_found" }
  }

  if (booking?.status === "confirmed" && payment?.status === "succeeded") {
    return {
      ok: true,
      alreadyConfirmed: true,
      bookingId: booking.id,
      orgId: reservation.orgId,
    }
  }

  const funnel = reservation.funnel
  if (!funnel?.timezone || !funnel.language || !funnel.sessionMode) {
    return { ok: false, error: "unavailable" }
  }

  const bookingId = booking?.id ?? randomUUID()
  const paymentId = payment?.id ?? randomUUID()
  const alreadyConfirmed = Boolean(booking?.status === "confirmed")

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        if (!booking) {
          await insertConfirmedFreeBooking(tx, {
            bookingId,
            paymentId,
            reservation,
            funnel,
          })
        } else if (!alreadyConfirmed) {
          const now = new Date()
          await tx
            .update(main.bookings)
            .set({
              status: "confirmed",
              confirmedAt: now,
              ...(funnel.guest?.taxId
                ? { buyerTaxId: funnel.guest.taxId }
                : {}),
            })
            .where(eq(main.bookings.id, bookingId))
          await tx
            .update(main.bookingPayments)
            .set({
              status: "succeeded",
              paidAt: now,
              paymentMethodType: "free",
            })
            .where(eq(main.bookingPayments.id, paymentId))
          await tx
            .update(main.slotReservations)
            .set({
              status: "converted",
              bookingId,
            })
            .where(eq(main.slotReservations.id, reservation.id))
        }

        await emitGuestActivation(tx, {
          orgId: reservation.orgId,
          bookingId,
          reservationId: reservation.id,
        })
        await ensureSessionRow(tx, {
          id: bookingId,
          orgId: reservation.orgId,
          eventTypeId: reservation.eventTypeId,
          expertProfileId: reservation.expertProfileId,
          memberUserId: reservation.userId,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          sessionMode: funnel.sessionMode,
        })
        await emitBookingNotificationEvent(tx, {
          orgId: reservation.orgId,
          type: "booking.confirmed",
          bookingId,
          startsAt: reservation.startsAt,
          occurredAt: new Date(),
        })
        await ctx.emit({
          entity: "booking",
          action: "confirmed",
          entityId: bookingId,
          payload: {
            reservationId: reservation.id,
            free: true,
            idempotentReplay: alreadyConfirmed,
          },
        })
      }
    )
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await loadFreeConfirmTarget(input.reservationId)
      if (raced?.booking?.status === "confirmed") {
        return {
          ok: true,
          alreadyConfirmed: true,
          bookingId: raced.booking.id,
          orgId: raced.reservation.orgId,
        }
      }
    }
    console.error("[bookings/confirm-free] confirm failed", err)
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    alreadyConfirmed,
    bookingId,
    orgId: reservation.orgId,
  }
}

async function insertConfirmedFreeBooking(
  tx: Tx,
  input: {
    bookingId: string
    paymentId: string
    reservation: typeof main.slotReservations.$inferSelect
    funnel: NonNullable<typeof main.slotReservations.$inferSelect.funnel>
  }
) {
  const { reservation, funnel } = input
  const now = new Date()
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
    priceCents: 0,
    priceAmount: 0,
    currency: reservation.currency ?? "EUR",
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    timezone: funnel.timezone,
    status: "confirmed",
    confirmedAt: now,
    sessionMode: funnel.sessionMode,
    bookedLocale: funnel.language,
    cancellationPolicy: reservation.cancellationPolicy ?? "flexible",
    cancellationPolicyVersion: CANCELLATION_POLICY_VERSION,
  })
  await tx.insert(main.bookingPayments).values({
    id: input.paymentId,
    orgId: reservation.orgId,
    bookingId: input.bookingId,
    status: "succeeded",
    amountCents: 0,
    applicationFeeCents: 0,
    appliedCommissionBps: 0,
    platformFeeNetCents: 0,
    platformFeeVatCents: 0,
    processingFeeCents: 0,
    transferGroup: input.bookingId,
    stripeIdempotencyKey: `free:${reservation.id}`,
    paymentMethodType: "free",
    paidAt: now,
  })
  await tx
    .update(main.slotReservations)
    .set({
      status: "converted",
      bookingId: input.bookingId,
    })
    .where(eq(main.slotReservations.id, reservation.id))
}

async function emitGuestActivation(
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

async function loadFreeConfirmTarget(reservationId: string) {
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

    const [payment] = booking
      ? await tx
          .select()
          .from(main.bookingPayments)
          .where(
            and(
              eq(main.bookingPayments.orgId, reservation.orgId),
              eq(main.bookingPayments.bookingId, booking.id)
            )
          )
          .limit(1)
      : [undefined]

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

    return { reservation, booking, payment, linkRevoked }
  })
}
