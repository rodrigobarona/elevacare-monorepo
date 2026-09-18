import type { DomainEventSubscriber } from "../domain-events"
import { activateGuestBooking } from "./guest-activation"

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
    logger: async (event) => {
      if (!event.type.startsWith("invoice.")) return
      requiredString(event.payload.invoiceKind, "invoiceKind")
      requiredString(event.payload.invoiceId, "invoiceId")
      requiredString(event.payload.bookingPaymentId, "bookingPaymentId")
      console.info("[domain-events] logger", {
        eventId: event.id,
        type: event.type,
        orgId: event.orgId,
        invoiceId: event.payload.invoiceId,
        status: event.payload.status,
      })
    },
  }
}

export { activateGuestBooking } from "./guest-activation"
