import type { DomainEventSubscriber } from "../domain-events"
import { handleCalendarSync } from "./calendar-sync"
import { activateGuestBooking } from "./guest-activation"
import { handleSendNotification } from "./send-notification"
import {
  cancelUnstartedSessionRoom,
  deleteSessionRoom,
  ensureSessionRoom,
} from "../video/ensure-session-room"

function financialEventTime(value: unknown): Date {
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  throw new Error("ensure-session-room: invalid payload field occurredAt")
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`guest-activation: missing payload field ${field}`)
  }
  return value
}

export function defaultDomainEventSubscribers(): Record<
  string,
  DomainEventSubscriber
> {
  return {
    "guest-activation": async (event) => {
      try {
        await activateGuestBooking({
          orgId: event.orgId,
          bookingId: requiredString(event.payload.bookingId, "bookingId"),
          reservationId: requiredString(
            event.payload.reservationId,
            "reservationId"
          ),
        })
      } catch (err) {
        console.error("[guest-activation] subscriber failed", event.id, err)
        throw err
      }
    },
    "send-notification": async (event) => {
      try {
        await handleSendNotification(event)
      } catch (err) {
        console.error("[send-notification] subscriber failed", event.id, err)
        throw err
      }
    },
    "calendar-sync": async (event) => {
      try {
        await handleCalendarSync(event)
      } catch (err) {
        console.error("[calendar-sync] subscriber failed", event.id, err)
        throw err
      }
    },
    "ensure-session-room": async (event) => {
      const bookingId = event.payload.bookingId
      if (typeof bookingId !== "string" || bookingId.length === 0) {
        throw new Error("ensure-session-room: missing payload field bookingId")
      }
      try {
        if (event.type === "booking.cancelled") {
          await deleteSessionRoom(bookingId)
          return
        }
        if (event.type === "payment.failed") {
          await cancelUnstartedSessionRoom(
            bookingId,
            {},
            financialEventTime(event.payload.occurredAt)
          )
          return
        }
        if (event.type === "refund.succeeded") {
          if (event.payload.cancelsSession === true) {
            await cancelUnstartedSessionRoom(
              bookingId,
              {},
              financialEventTime(event.payload.occurredAt)
            )
          }
          return
        }
        await ensureSessionRoom(bookingId)
      } catch (err) {
        console.error("[ensure-session-room] subscriber failed", event.id, err)
        throw err
      }
    },
  }
}

export { activateGuestBooking } from "./guest-activation"
export { handleSendNotification } from "./send-notification"
export { handleCalendarSync } from "./calendar-sync"
