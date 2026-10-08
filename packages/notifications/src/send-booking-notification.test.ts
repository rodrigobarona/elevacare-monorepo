import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LoadedBooking } from "./send-booking-notification"

const {
  renderBookingConfirmed,
  renderBookingCancelled,
  renderBookingRescheduled,
  renderBookingReminder,
  getEmailTranslations,
} = vi.hoisted(() => ({
  renderBookingConfirmed: vi.fn(async () => "<p>confirmed</p>"),
  renderBookingCancelled: vi.fn(async () => "<p>cancelled</p>"),
  renderBookingRescheduled: vi.fn(async () => "<p>rescheduled</p>"),
  renderBookingReminder: vi.fn(async () => "<p>reminder</p>"),
  getEmailTranslations: vi.fn(() => ({
    booking: {
      confirmedTitle: "New Booking Confirmed",
      rescheduledTitle: "Booking Rescheduled",
      cancelledTitle: "Booking Cancelled",
      reminder24hTitle: "Session reminder (24 h)",
      reminder1hTitle: "Session reminder (1 h)",
    },
    subject: {
      newBooking: (member: string, date: string) =>
        `New booking: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Rescheduled: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelled: ${member} — ${date}`,
      reminder24h: (member: string, date: string) =>
        `Reminder (24 h): ${member} — ${date}`,
      reminder1h: (member: string, date: string) =>
        `Reminder (1 h): ${member} — ${date}`,
    },
  })),
}))

vi.mock("@eleva/email", () => ({
  renderBookingConfirmed,
  renderBookingCancelled,
  renderBookingRescheduled,
  renderBookingReminder,
  getEmailTranslations,
}))
vi.mock("@eleva/db", () => ({
  auth: { user: {}, organization: {} },
  main: { bookings: {}, eventTypes: {} },
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("@eleva/config/env", () => ({
  resolveGatewayUrl: () => "https://eleva.care",
}))
vi.mock("@eleva/video/join-grant", () => ({
  mintJoinGrant: vi.fn(async ({ role }: { role: string }) => `grant-${role}`),
  sessionJoinPath: (bookingId: string, grant: string) =>
    `/join/${bookingId}?g=${grant}`,
  joinGrantExpUnix: (endsAt: Date) =>
    Math.floor((endsAt.getTime() + 30 * 60 * 1000) / 1000),
}))
vi.mock("./send-notification", () => ({
  sendNotification: vi.fn(),
}))

import { sendBookingNotification } from "./send-booking-notification"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const BOOKING_ID = "00000000-0000-4000-8000-000000000002"
const MEMBER_ID = "00000000-0000-4000-8000-000000000003"
const EXPERT_ID = "00000000-0000-4000-8000-000000000004"
const STARTS_AT_DATE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
STARTS_AT_DATE.setUTCSeconds(0, 0)
const STARTS_AT = STARTS_AT_DATE.toISOString()
const ENDS_AT = new Date(STARTS_AT_DATE.getTime() + 50 * 60 * 1000)
const PREVIOUS_STARTS_AT = new Date(
  STARTS_AT_DATE.getTime() - 2 * 24 * 60 * 60 * 1000
).toISOString()
const DTSTART = STARTS_AT.replace(/[-:]/g, "").replace(/\.\d{3}/, "")
const OCCURRED_AT = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

function unfoldIcs(content: string): string {
  return content.replace(/\r\n /g, "")
}

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
    orgSlug: "acme",
    status: "confirmed",
    startsAt: new Date(STARTS_AT),
    endsAt: ENDS_AT,
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
    scheduleRevision: 0,
    cancellationPolicy: "moderate",
    currency: "EUR",
    ...overrides,
  }
}

describe("sendBookingNotification", () => {
  beforeEach(() => {
    renderBookingConfirmed.mockClear()
    renderBookingCancelled.mockClear()
    renderBookingRescheduled.mockClear()
    renderBookingReminder.mockClear()
    getEmailTranslations.mockClear()
  })

  it("states the policy and refund in the cancellation email", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.cancelled", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-cancel",
        type: "booking.cancelled",
        orgId: ORG_ID,
        payload: eventPayload({ refundCents: 3000 }),
      },
      {
        loadBooking: async () => booking({ status: "cancelled" }),
        send,
      }
    )
    expect(renderBookingCancelled).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationPolicyName: "Moderate",
        refundAmount: "€30.00",
      })
    )
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
    expect(renderBookingConfirmed).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        joinHref: `https://eleva.care/join/${BOOKING_ID}?g=grant-member`,
      })
    )
    expect(renderBookingConfirmed).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        joinHref: `https://eleva.care/join/${BOOKING_ID}?g=grant-expert`,
      })
    )
  })

  it("omits join links for in-person sessions and 24h reminders", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.confirmed", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-in-person",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      {
        loadBooking: async () => booking({ sessionMode: "in_person" }),
        send,
      }
    )
    expect(renderBookingConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ joinHref: undefined })
    )

    renderBookingReminder.mockClear()
    send.mockResolvedValue({ kind: "booking.reminder_24h", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-24h",
        type: "booking.reminder_24h",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send }
    )
    expect(renderBookingReminder).toHaveBeenCalledWith(
      expect.objectContaining({ window: "24h", joinHref: undefined })
    )
  })

  it("puts an Eleva join deep link on the 1h reminder", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.reminder_1h", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-1h",
        type: "booking.reminder_1h",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send }
    )
    expect(renderBookingReminder).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        window: "1h",
        joinHref: `https://eleva.care/join/${BOOKING_ID}?g=grant-member`,
      })
    )
    expect(renderBookingReminder).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        joinHref: `https://eleva.care/join/${BOOKING_ID}?g=grant-expert`,
      })
    )
  })

  it("attaches a PHI-free calendar invite to both confirmation emails", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.confirmed", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-ics",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send }
    )
    const [memberIcs] = send.mock.calls[0]?.[0].ctx.attachments ?? []
    const [expertIcs] = send.mock.calls[1]?.[0].ctx.attachments ?? []
    expect(memberIcs).toMatchObject({
      filename: "invite.ics",
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
    })
    expect(memberIcs.content).toContain("METHOD:REQUEST")
    expect(memberIcs.content).toContain(`UID:${BOOKING_ID}@eleva.care`)
    expect(memberIcs.content).toContain(`DTSTART:${DTSTART}`)
    expect(memberIcs.content).toContain("SEQUENCE:0")
    expect(memberIcs.content).toContain("SUMMARY:Eleva session with Ana")
    expect(memberIcs.content).toContain("mailto:ada@example.com")
    expect(unfoldIcs(memberIcs.content)).toContain(
      `URL:https://eleva.care/join/${BOOKING_ID}?g=grant-member`
    )
    expect(unfoldIcs(memberIcs.content)).toContain(
      `LOCATION:https://eleva.care/join/${BOOKING_ID}?g=grant-member`
    )
    expect(expertIcs.content).toContain("SUMMARY:Eleva session with Ada")
    expect(unfoldIcs(expertIcs.content)).toContain(
      `URL:https://eleva.care/join/${BOOKING_ID}?g=grant-expert`
    )
    for (const ics of [memberIcs.content, expertIcs.content]) {
      expect(ics).not.toContain("First visit")
      expect(ics).not.toContain("Lovelace")
      expect(ics).not.toContain("t=")
    }
  })

  it("attaches a CANCEL invite that supersedes the last revision", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.cancelled", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-ics-cancel",
        type: "booking.cancelled",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      {
        loadBooking: async () =>
          booking({ status: "cancelled", scheduleRevision: 2 }),
        send,
      }
    )
    const [ics] = send.mock.calls[0]?.[0].ctx.attachments ?? []
    expect(ics.filename).toBe("cancel.ics")
    expect(ics.content).toContain("METHOD:CANCEL")
    expect(ics.content).toContain("STATUS:CANCELLED")
    expect(ics.content).toContain("SEQUENCE:3")
    expect(ics.content).not.toContain("URL:")
  })

  it("does not attach calendar files to reminders", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.reminder_24h", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-reminder-ics",
        type: "booking.reminder_24h",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send }
    )
    expect(send.mock.calls[0]?.[0].ctx.attachments).toBeUndefined()
  })

  it("discriminates repeat reschedules in the idempotency key", async () => {
    const send = vi.fn().mockResolvedValue({
      kind: "booking.rescheduled",
      deliveries: [],
    })
    const previousStartsAt = PREVIOUS_STARTS_AT
    await sendBookingNotification(
      {
        id: "evt-reschedule",
        type: "booking.rescheduled",
        orgId: ORG_ID,
        payload: eventPayload({ previousStartsAt, scheduleRevision: 1 }),
      },
      {
        loadBooking: async () =>
          booking({ status: "rescheduled", scheduleRevision: 1 }),
        send,
      }
    )
    expect(send.mock.calls[0]?.[0].idempotencyKey).toBe(
      `booking:${BOOKING_ID}:rescheduled:${previousStartsAt}:${STARTS_AT}:1`
    )
    expect(renderBookingRescheduled).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        joinHref: `https://eleva.care/join/${BOOKING_ID}?g=grant-member`,
      })
    )
    const memberIcs = unfoldIcs(
      send.mock.calls[0]?.[0].ctx.attachments?.[0].content ?? ""
    )
    expect(memberIcs).toContain(`g=grant-member`)
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

  it("sends a 24h reminder only while the booking is still confirmed", async () => {
    const send = vi.fn().mockResolvedValue({
      kind: "booking.reminder_24h",
      deliveries: [],
    })
    await sendBookingNotification(
      {
        id: "evt-reminder",
        type: "booking.reminder_24h",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      { loadBooking: async () => booking(), send }
    )
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        kind: "booking.reminder_24h",
        idempotencyKey: `booking:${BOOKING_ID}:reminder_24h:${STARTS_AT}`,
      })
    )
    expect(send.mock.calls[0]?.[0].ctx.body).toMatch(/^Your session with Ana /)
  })

  it("still sends reminders after a reschedule when startsAt matches", async () => {
    const send = vi.fn().mockResolvedValue({
      kind: "booking.reminder_1h",
      deliveries: [],
    })
    await sendBookingNotification(
      {
        id: "evt-reminder-rescheduled",
        type: "booking.reminder_1h",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      {
        loadBooking: async () => booking({ status: "rescheduled" }),
        send,
      }
    )
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("skips reminders after cancel without deleting QStash", async () => {
    const send = vi.fn()
    await sendBookingNotification(
      {
        id: "evt-stale-reminder",
        type: "booking.reminder_1h",
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
          previousStartsAt: PREVIOUS_STARTS_AT,
          scheduleRevision: 1,
        }),
      },
      {
        loadBooking: async () =>
          booking({
            status: "rescheduled",
            scheduleRevision: 3,
          }),
        send,
      }
    )
    expect(send).not.toHaveBeenCalled()
  })

  it("omits join links when the grant window has already closed", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ kind: "booking.confirmed", deliveries: [] })
    await sendBookingNotification(
      {
        id: "evt-late-join",
        type: "booking.confirmed",
        orgId: ORG_ID,
        payload: eventPayload(),
      },
      {
        loadBooking: async () =>
          booking({ endsAt: new Date("2020-01-01T00:00:00.000Z") }),
        send,
      }
    )
    expect(renderBookingConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ joinHref: undefined })
    )
    const [memberIcs] = send.mock.calls[0]?.[0].ctx.attachments ?? []
    expect(unfoldIcs(memberIcs.content)).not.toContain("URL:")
  })
})
