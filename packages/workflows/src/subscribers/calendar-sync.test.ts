import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  row: undefined as Record<string, unknown> | undefined,
}))

vi.mock("@eleva/db", () => ({ main: { sessions: {}, bookings: {} } }))

vi.mock("@eleva/db/context", () => ({
  withOrgContext: async (_orgId: string, fn: (tx: unknown) => unknown) => {
    const chain = {
      select: () => chain,
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      limit: async () => (state.row ? [state.row] : []),
    }
    return fn(chain)
  },
}))

vi.mock("@eleva/notifications", () => ({
  isBookingNotificationKind: (type: string) => type.startsWith("booking."),
  parseBookingNotificationPayload: (
    _type: string,
    payload: { bookingId: string }
  ) => ({ bookingId: payload.bookingId }),
}))

vi.mock("../scheduling/calendar-event-sync", () => ({
  calendarEventCreate: vi.fn(),
  calendarEventUpdate: vi.fn(),
  calendarEventDelete: vi.fn(),
}))

vi.mock("drizzle-orm", () => ({ eq: () => undefined }))

import {
  calendarEventCreate,
  calendarEventDelete,
  calendarEventUpdate,
} from "../scheduling/calendar-event-sync"
import { handleCalendarSync } from "./calendar-sync"

const startsAt = new Date("2026-11-02T10:00:00.000Z")
const endsAt = new Date("2026-11-02T10:50:00.000Z")

function event(type: string) {
  return { id: "evt", type, orgId: "org-1", payload: { bookingId: "bk-1" } }
}

function session(bookingStatus: string, calendarEventId: string | null) {
  return {
    sessionId: "ses-1",
    startsAt,
    endsAt,
    calendarEventId,
    bookingStatus,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.row = undefined
})

describe("calendar-sync subscriber", () => {
  it("creates the event when a confirmed booking has none", async () => {
    state.row = session("confirmed", null)
    await handleCalendarSync(event("booking.confirmed") as never)
    expect(calendarEventCreate).toHaveBeenCalledWith({
      sessionId: "ses-1",
      orgId: "org-1",
      bookingId: "bk-1",
    })
  })

  it("does not recreate a booking cancelled before the event ran", async () => {
    state.row = session("cancelled", null)
    await handleCalendarSync(event("booking.confirmed") as never)
    expect(calendarEventCreate).not.toHaveBeenCalled()
  })

  it("moves the event to the session's current times on reschedule", async () => {
    state.row = session("rescheduled", "cal-1")
    await handleCalendarSync(event("booking.rescheduled") as never)
    expect(calendarEventUpdate).toHaveBeenCalledWith({
      sessionId: "ses-1",
      orgId: "org-1",
      newStartTime: startsAt,
      newEndTime: endsAt,
    })
  })

  it("creates on reschedule when the original create never landed", async () => {
    state.row = session("rescheduled", null)
    await handleCalendarSync(event("booking.rescheduled") as never)
    expect(calendarEventCreate).toHaveBeenCalledTimes(1)
    expect(calendarEventUpdate).not.toHaveBeenCalled()
  })

  it("deletes on cancel only once the booking is no longer active", async () => {
    state.row = session("cancelled", "cal-1")
    await handleCalendarSync(event("booking.cancelled") as never)
    expect(calendarEventDelete).toHaveBeenCalledWith({
      sessionId: "ses-1",
      orgId: "org-1",
    })
  })

  it("ignores non-booking events and bookings without a session", async () => {
    await handleCalendarSync(event("payment.failed") as never)
    await handleCalendarSync(event("booking.confirmed") as never)
    expect(calendarEventCreate).not.toHaveBeenCalled()
    expect(calendarEventDelete).not.toHaveBeenCalled()
  })
})
