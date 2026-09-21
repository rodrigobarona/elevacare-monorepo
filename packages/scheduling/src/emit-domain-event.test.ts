import { describe, expect, it } from "vitest"
import {
  BOOKING_NOTIFICATION_EVENT_TYPES,
  bookingNotificationIdempotencyKey,
  emitBookingNotificationEvent,
} from "./emit-domain-event"

describe("booking notification events", () => {
  it("covers confirmed, cancelled, and rescheduled without issued invoices", () => {
    expect(BOOKING_NOTIFICATION_EVENT_TYPES).toEqual([
      "booking.confirmed",
      "booking.cancelled",
      "booking.rescheduled",
    ])
    expect(BOOKING_NOTIFICATION_EVENT_TYPES).not.toContain("invoice.issued")
  })

  it("inserts a send-notification delivery for booking.confirmed", async () => {
    const inserts: unknown[] = []
    const tx = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserts.push(values)
          return {
            onConflictDoNothing: () => ({
              returning: async () =>
                typeof values.type === "string" ? [{ id: "evt-1" }] : [],
            }),
          }
        },
      }),
    }

    const result = await emitBookingNotificationEvent(tx as never, {
      orgId: "00000000-0000-4000-8000-000000000001",
      type: "booking.confirmed",
      bookingId: "00000000-0000-4000-8000-000000000002",
      startsAt: new Date("2026-09-22T10:00:00.000Z"),
      occurredAt: new Date("2026-09-21T10:00:00.000Z"),
    })

    expect(result).toEqual({ eventId: "evt-1", created: true })
    expect(inserts[0]).toEqual(
      expect.objectContaining({
        type: "booking.confirmed",
        idempotencyKey:
          "booking:00000000-0000-4000-8000-000000000002:confirmed",
      })
    )
    expect(inserts[1]).toEqual(
      expect.objectContaining({
        subscriberId: "send-notification",
        status: "pending",
        eventId: "evt-1",
      })
    )
  })

  it("stores scheduleRevision on a booking.rescheduled outbox row", async () => {
    const inserts: unknown[] = []
    const tx = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserts.push(values)
          return {
            onConflictDoNothing: () => ({
              returning: async () =>
                typeof values.type === "string" ? [{ id: "evt-2" }] : [],
            }),
          }
        },
      }),
    }
    const startsAt = new Date("2026-09-21T10:00:00.000Z")
    const previousStartsAt = new Date("2026-09-20T10:00:00.000Z")
    await emitBookingNotificationEvent(tx as never, {
      orgId: "00000000-0000-4000-8000-000000000001",
      type: "booking.rescheduled",
      bookingId: "00000000-0000-4000-8000-000000000002",
      startsAt,
      previousStartsAt,
      occurredAt: new Date("2026-09-21T09:00:00.000Z"),
      scheduleRevision: 3,
    })
    expect(inserts[0]).toEqual(
      expect.objectContaining({
        type: "booking.rescheduled",
        idempotencyKey:
          "booking:00000000-0000-4000-8000-000000000002:rescheduled:2026-09-20T10:00:00.000Z:2026-09-21T10:00:00.000Z:3",
        payload: expect.objectContaining({
          previousStartsAt: "2026-09-20T10:00:00.000Z",
          scheduleRevision: 3,
        }),
      })
    )
  })

  it("gives each reschedule occurrence a distinct outbox key", async () => {
    const bookingId = "00000000-0000-4000-8000-000000000002"
    const timeA = "2026-09-20T10:00:00.000Z"
    const timeB = "2026-09-21T10:00:00.000Z"
    const aToB = bookingNotificationIdempotencyKey({
      bookingId,
      type: "booking.rescheduled",
      previousStartsAt: timeA,
      startsAt: timeB,
      scheduleRevision: 1,
    })
    const bToA = bookingNotificationIdempotencyKey({
      bookingId,
      type: "booking.rescheduled",
      previousStartsAt: timeB,
      startsAt: timeA,
      scheduleRevision: 2,
    })
    const aToC = bookingNotificationIdempotencyKey({
      bookingId,
      type: "booking.rescheduled",
      previousStartsAt: timeA,
      startsAt: "2026-09-22T10:00:00.000Z",
      scheduleRevision: 1,
    })
    const aToBAgain = bookingNotificationIdempotencyKey({
      bookingId,
      type: "booking.rescheduled",
      previousStartsAt: timeA,
      startsAt: timeB,
      scheduleRevision: 3,
    })
    expect(aToB).not.toBe(bToA)
    expect(aToB).not.toBe(aToC)
    expect(aToB).not.toBe(aToBAgain)
    expect(aToB).toBe(`booking:${bookingId}:rescheduled:${timeA}:${timeB}:1`)
  })

  it("keeps a retry of the same reschedule occurrence on one key", () => {
    const input = {
      bookingId: "00000000-0000-4000-8000-000000000002",
      type: "booking.rescheduled" as const,
      previousStartsAt: "2026-09-20T10:00:00.000Z",
      startsAt: "2026-09-21T10:00:00.000Z",
      scheduleRevision: 2,
    }
    expect(bookingNotificationIdempotencyKey(input)).toBe(
      bookingNotificationIdempotencyKey(input)
    )
  })
})
