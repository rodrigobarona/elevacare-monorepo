import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LoadedBooking } from "./send-booking-notification"

const {
  renderBookingConfirmed,
  renderBookingCancelled,
  renderBookingRescheduled,
  getEmailTranslations,
} = vi.hoisted(() => ({
  renderBookingConfirmed: vi.fn(async () => "<p>confirmed</p>"),
  renderBookingCancelled: vi.fn(async () => "<p>cancelled</p>"),
  renderBookingRescheduled: vi.fn(async () => "<p>rescheduled</p>"),
  getEmailTranslations: vi.fn(() => ({
    booking: {
      confirmedTitle: "New Booking Confirmed",
      rescheduledTitle: "Booking Rescheduled",
      cancelledTitle: "Booking Cancelled",
    },
    subject: {
      newBooking: (member: string, date: string) =>
        `New booking: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Rescheduled: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelled: ${member} — ${date}`,
    },
  })),
}))

vi.mock("@eleva/email", () => ({
  renderBookingConfirmed,
  renderBookingCancelled,
  renderBookingRescheduled,
  getEmailTranslations,
}))
vi.mock("@eleva/db", () => ({
  auth: { user: {} },
  main: { bookings: {}, eventTypes: {} },
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("./send-notification", () => ({
  sendNotification: vi.fn(),
}))

import { sendBookingNotification } from "./send-booking-notification"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const BOOKING_ID = "00000000-0000-4000-8000-000000000002"
const MEMBER_ID = "00000000-0000-4000-8000-000000000003"
const EXPERT_ID = "00000000-0000-4000-8000-000000000004"
const STARTS_AT = "2026-09-22T10:00:00.000Z"
const OCCURRED_AT = "2026-09-21T15:00:00.000Z"

function eventPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    bookingId: BOOKING_ID,
    startsAt: STARTS_AT,
    occurredAt: OCCURRED_AT,
    ...overrides,
  }
}

function booking(overrides: Partial<LoadedBooking> = {}): LoadedBooking {
  return {
    id: BOOKING_ID,
    orgId: ORG_ID,
    status: "confirmed",
    startsAt: new Date("2026-09-22T10:00:00.000Z"),
    endsAt: new Date("2026-09-22T10:50:00.000Z"),
    updatedAt: new Date(OCCURRED_AT),
    timezone: "Europe/Lisbon",
    sessionMode: "online",
    bookedLocale: "en",
    memberUserId: MEMBER_ID,
    memberEmail: "ada@example.com",
    memberName: "Ada Lovelace",
    guestEmail: null,
    guestName: null,
    expertUserId: EXPERT_ID,
    expertEmail: "ana@example.com",
    expertName: "Ana Silva",
    eventTypeName: { en: "First visit" },
    ...overrides,
  }
}

describe("sendBookingNotification", () => {
  beforeEach(() => {
    renderBookingConfirmed.mockClear()
    renderBookingCancelled.mockClear()
    renderBookingRescheduled.mockClear()
    getEmailTranslations.mockClear()
  })

  it("sends member and expert with the same idempotency key", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.confirmed", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-1",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send }
    )
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        kind: "booking.confirmed",
        orgId: ORG_ID,
        recipient: { userId: MEMBER_ID },
        idempotencyKey: `booking:${BOOKING_ID}:confirmed`,
      })
    )
    expect(send.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        kind: "booking.confirmed",
        recipient: { userId: EXPERT_ID },
        idempotencyKey: `booking:${BOOKING_ID}:confirmed`,
      })
    )
    expect(send.mock.calls[0]?.[0].ctx.body).toMatch(/^Your session with Ana /)
    expect(send.mock.calls[0]?.[0].ctx.subject).toMatch(
      /^New Booking Confirmed — /
    )
    expect(send.mock.calls[1]?.[0].ctx.body).toMatch(/^New booking: Ada /)
    expect(send.mock.calls[1]?.[0].ctx.subject).toMatch(/^New booking: Ada /)
    expect(send.mock.calls[0]?.[0].ctx.html).toBe("<p>confirmed</p>")
    expect(send.mock.calls[1]?.[0].ctx.html).toBe("<p>confirmed</p>")
  })

  it("discriminates repeat reschedules in the idempotency key", async () => {
    const send = vi.fn().mockResolvedValue({
      kind: "booking.rescheduled",
      deliveries: [],
    })
    const previousStartsAt = "2026-09-20T10:00:00.000Z"
    await sendBookingNotification(
      {
        id: "evt-reschedule",
        type: "booking.rescheduled",
        orgId: ORG_ID,
        payload: eventPayload({ previousStartsAt }),
      },
      {
        loadBooking: async () => booking({ status: "rescheduled" }),
        send,
      }
    )
    expect(send.mock.calls[0]?.[0].idempotencyKey).toBe(
      `booking:${BOOKING_ID}:rescheduled:${previousStartsAt}:${STARTS_AT}`
    )
  })

  it("uses identical guest copy whether or not an account exists", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.confirmed", deliveries: [] })
    const guest = booking({
      memberUserId: null,
      memberEmail: null,
      memberName: null,
      guestEmail: "guest@example.com",
      guestName: "Ada Lovelace",
    })
    await sendBookingNotification(
      {
        id: "evt-guest",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => guest, send }
    )
    const accountSend = vi.fn().mockResolvedValue({
      kind: "booking.confirmed",
      deliveries: [],
    })
    await sendBookingNotification(
      {
        id: "evt-account",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send: accountSend }
    )
    expect(send.mock.calls[0]?.[0].ctx.html).toBe(
      accountSend.mock.calls[0]?.[0].ctx.html
    )
    expect(send.mock.calls[0]?.[0].ctx.subject).toBe(
      accountSend.mock.calls[0]?.[0].ctx.subject
    )
    expect(send.mock.calls[0]?.[0].recipient).toEqual({
      email: "guest@example.com",
      locale: "en",
    })
  })

  it("localizes the member in-app body", async () => {
    const send = vi.fn().mockResolvedValue({
      kind: "booking.confirmed",
      deliveries: [],
    })
    await sendBookingNotification(
      {
        id: "evt-pt",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      {
        loadBooking: async () => booking({ bookedLocale: "pt" }),
        send,
      }
    )
    expect(send.mock.calls[0]?.[0].ctx.body).toMatch(/^A sua sessão com Ana /)
  })

  it("does not send invoice.issued", async () => {
    const send = vi.fn()
    await expect(
      sendBookingNotification(
        {
          id: "evt-issued",
          type: "invoice.issued",
          orgId: ORG_ID,
          payload: eventPayload(),
        },
        { loadBooking: async () => booking(), send }
      )
    ).rejects.toThrow(/unsupported booking event/)
    expect(send).not.toHaveBeenCalled()
  })

  it("rejects a booking that does not belong to the event org", async () => {
    const send = vi.fn()
    await expect(
      sendBookingNotification(
        {
          id: "evt-mismatch",
          type: "booking.cancelled",
          orgId: ORG_ID,
          payload: eventPayload(),
        },
        {
          loadBooking: async () =>
            booking({ orgId: "00000000-0000-4000-8000-000000000099" }),
          send,
        }
      )
    ).rejects.toThrow(/booking not found for event org/)
    expect(send).not.toHaveBeenCalled()
  })

  it("skips a delayed confirmation after the booking was cancelled", async () => {
    const send = vi.fn()
    await sendBookingNotification(
      {
        id: "evt-stale",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      {
        loadBooking: async () => booking({ status: "cancelled" }),
        send,
      }
    )
    expect(send).not.toHaveBeenCalled()
  })

  it("skips a delayed reschedule after a later transition", async () => {
    const send = vi.fn()
    await sendBookingNotification(
      {
        id: "evt-stale-reschedule",
        type: "booking.rescheduled",
        orgId: ORG_ID,
        payload: eventPayload({
          previousStartsAt: "2026-09-20T10:00:00.000Z",
        }),
      },
      {
        loadBooking: async () =>
          booking({
            status: "rescheduled",
            updatedAt: new Date("2026-09-21T18:00:00.000Z"),
          }),
        send,
      }
    )
    expect(send).not.toHaveBeenCalled()
  })
})
