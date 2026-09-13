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
  }
}

export { activateGuestBooking } from "./guest-activation"
