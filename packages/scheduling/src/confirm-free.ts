import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  CANCELLATION_POLICY_VERSION,
  resolveApprovalDeadline,
} from "@eleva/config"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import {
  authorizeConfirmAccess,
  emitGuestActivationRequired,
  isUniqueViolation,
  type ConfirmBookingPaymentResult,
} from "./confirm-booking"
import { emitBookingNotificationEvent } from "./emit-domain-event"
import { ensureSessionRow } from "./ensure-session-row"
import { persistIntakeAfterConfirm } from "./persist-booking-intake"

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

  if (
    (booking?.status === "confirmed" ||
      booking?.status === "awaiting_confirmation") &&
    payment?.status === "succeeded"
  ) {
    await persistIntakeAfterConfirm(booking.id)
    return freeConfirmResult({
      bookingId: booking.id,
      orgId: reservation.orgId,
      alreadyConfirmed: true,
      status:
        booking.status === "awaiting_confirmation"
          ? "awaiting_confirmation"
          : "confirmed",
      approvalDeadlineAt: booking.approvalDeadlineAt,
    })
  }

  const funnel = reservation.funnel
  if (!funnel?.timezone || !funnel.language || !funnel.sessionMode) {
    return { ok: false, error: "unavailable" }
  }

  const bookingId = booking?.id ?? randomUUID()
  const paymentId = payment?.id ?? randomUUID()
  const requestApproval = reservation.requiresApproval === true
  const alreadyConfirmed = Boolean(
    booking?.status === "confirmed" ||
    booking?.status === "awaiting_confirmation"
  )
  const now = new Date()
  const approvalDeadlineAt = requestApproval
    ? resolveApprovalDeadline({ now, startsAt: reservation.startsAt })
    : null

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
            requiresApproval: requestApproval,
            approvalDeadlineAt,
            now,
          })
        } else if (!alreadyConfirmed) {
          await tx
            .update(main.bookings)
            .set({
              status: requestApproval ? "awaiting_confirmation" : "confirmed",
              confirmedAt: requestApproval ? null : now,
              requiresApproval: requestApproval,
              approvalDeadlineAt,
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

        if (requestApproval) {
          if (!alreadyConfirmed) {
            await emitBookingNotificationEvent(tx, {
              orgId: reservation.orgId,
              type: "booking.requested",
              bookingId,
              startsAt: reservation.startsAt,
              occurredAt: now,
            })
          }
          await ctx.emit({
            entity: "booking",
            action: "submitted",
            entityId: bookingId,
            payload: {
              reservationId: reservation.id,
              free: true,
              idempotentReplay: alreadyConfirmed,
              status: "awaiting_confirmation",
            },
          })
          return
        }

        await emitGuestActivationRequired(tx, {
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
          occurredAt: now,
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
      if (
        raced?.booking?.status === "confirmed" ||
        raced?.booking?.status === "awaiting_confirmation"
      ) {
        await persistIntakeAfterConfirm(raced.booking.id)
        return freeConfirmResult({
          bookingId: raced.booking.id,
          orgId: raced.reservation.orgId,
          alreadyConfirmed: true,
          status:
            raced.booking.status === "awaiting_confirmation"
              ? "awaiting_confirmation"
              : "confirmed",
          approvalDeadlineAt: raced.booking.approvalDeadlineAt,
        })
      }
    }
    console.error("[bookings/confirm-free] confirm failed", err)
    return { ok: false, error: "db_error" }
  }

  await persistIntakeAfterConfirm(bookingId)
  return freeConfirmResult({
    bookingId,
    orgId: reservation.orgId,
    alreadyConfirmed,
    status: requestApproval ? "awaiting_confirmation" : "confirmed",
    approvalDeadlineAt,
  })
}

function freeConfirmResult(input: {
  bookingId: string
  orgId: string
  alreadyConfirmed: boolean
  status: "confirmed" | "awaiting_confirmation"
  approvalDeadlineAt?: Date | null
}): Extract<ConfirmBookingPaymentResult, { ok: true }> {
  return {
    ok: true,
    alreadyConfirmed: input.alreadyConfirmed,
    bookingId: input.bookingId,
    orgId: input.orgId,
    status: input.status,
    ...(input.approvalDeadlineAt
      ? { approvalDeadlineAt: input.approvalDeadlineAt.toISOString() }
      : {}),
  }
}

async function insertConfirmedFreeBooking(
  tx: Tx,
  input: {
    bookingId: string
    paymentId: string
    reservation: typeof main.slotReservations.$inferSelect
    funnel: NonNullable<typeof main.slotReservations.$inferSelect.funnel>
    requiresApproval: boolean
    approvalDeadlineAt: Date | null
    now: Date
  }
) {
  const { reservation, funnel, now } = input
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
    status: input.requiresApproval ? "awaiting_confirmation" : "confirmed",
    confirmedAt: input.requiresApproval ? null : now,
    requiresApproval: input.requiresApproval,
    approvalDeadlineAt: input.approvalDeadlineAt,
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
