import { eq } from "drizzle-orm"
import { main, type Tx } from "@eleva/db"

export const BOOKING_NOTIFICATION_EVENT_TYPES = [
  "booking.confirmed",
  "booking.cancelled",
  "booking.rescheduled",
] as const

export type BookingNotificationEventType =
  (typeof BOOKING_NOTIFICATION_EVENT_TYPES)[number]

export const SEND_NOTIFICATION_SUBSCRIBER = "send-notification" as const

export type BookingNotificationPayload = {
  bookingId: string
  startsAt: string
  occurredAt: string
  previousStartsAt?: string
}

export function bookingNotificationIdempotencyKey(input: {
  bookingId: string
  type: BookingNotificationEventType
  startsAt: string
  previousStartsAt?: string
}): string {
  const suffix = input.type.slice("booking.".length)
  if (input.type === "booking.rescheduled") {
    if (!input.previousStartsAt) {
      throw new Error("booking.rescheduled requires previousStartsAt")
    }
    return `booking:${input.bookingId}:${suffix}:${input.previousStartsAt}:${input.startsAt}`
  }
  return `booking:${input.bookingId}:${suffix}`
}

export type EmitBookingNotificationInput =
  | {
      orgId: string
      type: "booking.confirmed" | "booking.cancelled"
      bookingId: string
      startsAt: Date
      occurredAt: Date
    }
  | {
      orgId: string
      type: "booking.rescheduled"
      bookingId: string
      startsAt: Date
      previousStartsAt: Date
      occurredAt: Date
    }

/**
 * Scheduling cannot import `@eleva/workflows` (workflows -> billing ->
 * scheduling). Mirror `emitDomainEvent` for booking notification kinds.
 */
export async function emitBookingNotificationEvent(
  tx: Tx,
  input: EmitBookingNotificationInput
): Promise<{ eventId: string; created: boolean }> {
  const startsAt = input.startsAt.toISOString()
  const occurredAt = input.occurredAt.toISOString()
  const previousStartsAt =
    input.type === "booking.rescheduled"
      ? input.previousStartsAt.toISOString()
      : undefined
  if (input.type === "booking.rescheduled" && !previousStartsAt) {
    throw new Error("booking.rescheduled requires previousStartsAt")
  }
  const idempotencyKey = bookingNotificationIdempotencyKey({
    bookingId: input.bookingId,
    type: input.type,
    startsAt,
    previousStartsAt,
  })
  const payload: BookingNotificationPayload = {
    bookingId: input.bookingId,
    startsAt,
    occurredAt,
    ...(previousStartsAt ? { previousStartsAt } : {}),
  }

  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: input.type,
      payload,
      idempotencyKey,
    })
    .onConflictDoNothing({
      target: main.domainEventsOutbox.idempotencyKey,
    })
    .returning({ id: main.domainEventsOutbox.id })

  let eventId = inserted[0]?.id
  const created = Boolean(eventId)
  if (!eventId) {
    const [existing] = await tx
      .select({ id: main.domainEventsOutbox.id })
      .from(main.domainEventsOutbox)
      .where(eq(main.domainEventsOutbox.idempotencyKey, idempotencyKey))
      .limit(1)
    if (!existing) {
      throw new Error(
        "emitBookingNotificationEvent: conflict without existing row"
      )
    }
    eventId = existing.id
  }

  await tx
    .insert(main.domainEventDeliveries)
    .values({
      orgId: input.orgId,
      eventId,
      subscriberId: SEND_NOTIFICATION_SUBSCRIBER,
      status: "pending",
    })
    .onConflictDoNothing()

  return { eventId, created }
}
