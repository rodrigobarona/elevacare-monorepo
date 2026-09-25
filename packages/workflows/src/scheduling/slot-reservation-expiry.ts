import { settleExpiredReservationIntent } from "@eleva/billing/server"
import { captureException, heartbeat } from "@eleva/observability"
import {
  deferKeptReservation,
  finalizeExpiredReservation,
  listExpiredReservations,
} from "@eleva/scheduling"

export const SLOT_RESERVATION_EXPIRY_BATCH_SIZE = 100

/**
 * Expire active slot reservations whose hold has passed (every minute via
 * QStash). Stripe is consulted before any DB write: a reservation whose
 * intent can still settle (MB WAY `processing`, succeeded awaiting confirm)
 * is kept and re-checked after 10 minutes; otherwise the intent is cancelled and the reservation expired
 * together with its `pending_payment` booking and private-link use.
 */

export type SlotExpiryResult = {
  scanned: number
  expired: number
  kept: number
  bookingsCancelled: number
  linkUsesReleased: number
  errors: number
}

export async function expireStaleReservations(
  options: { now?: Date; batchSize?: number } = {}
): Promise<SlotExpiryResult> {
  const now = options.now ?? new Date()
  const result: SlotExpiryResult = {
    scanned: 0,
    expired: 0,
    kept: 0,
    bookingsCancelled: 0,
    linkUsesReleased: 0,
    errors: 0,
  }

  try {
    const candidates = await listExpiredReservations({
      now,
      limit: options.batchSize ?? SLOT_RESERVATION_EXPIRY_BATCH_SIZE,
    })
    result.scanned = candidates.length

    for (const reservation of candidates) {
      try {
        const decision = await settleExpiredReservationIntent({
          reservationId: reservation.id,
          paymentIntentId: reservation.stripePaymentIntentId,
          searchByReservation: reservation.hasIntentPendingPayment,
        })
        if (decision.action === "keep") {
          await deferKeptReservation({
            orgId: reservation.orgId,
            reservationId: reservation.id,
            paymentIntentId: decision.paymentIntentId,
            reason: decision.reason,
            now,
          })
          result.kept += 1
          continue
        }
        const finalized = await finalizeExpiredReservation({
          orgId: reservation.orgId,
          reservationId: reservation.id,
          cancelledIntentIds: decision.cancelledIntentIds,
          now,
        })
        if (finalized.expired) result.expired += 1
        if (finalized.bookingCancelled) result.bookingsCancelled += 1
        if (finalized.linkUseReleased) result.linkUsesReleased += 1
      } catch (err) {
        result.errors += 1
        await captureException(err, {
          workflow: "slotReservationExpiry",
          reservationId: reservation.id,
        })
      }
    }
  } catch (err) {
    result.errors += 1
    await captureException(err, { workflow: "slotReservationExpiry" })
  }

  await heartbeat("slot-reservation-expiry")
  return result
}
