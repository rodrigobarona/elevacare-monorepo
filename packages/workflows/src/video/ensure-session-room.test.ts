import { describe, expect, it } from "vitest"
import {
  classifyRoomLease,
  classifySessionRoomBooking,
  expectedRoomName,
  needsCancelledSessionPlaceholder,
  shouldCancelUnstartedSession,
} from "./ensure-session-room"

const booking = {
  status: "confirmed",
  sessionMode: "online" as const,
  memberUserId: "user-1",
  language: "pt",
}

describe("classifySessionRoomBooking", () => {
  it("skips phone and in-person bookings", () => {
    expect(
      classifySessionRoomBooking({ ...booking, sessionMode: "phone" })
    ).toEqual({ skipped: "not_online" })
    expect(
      classifySessionRoomBooking({ ...booking, sessionMode: "in_person" })
    ).toEqual({ skipped: "not_online" })
  })

  it("skips bookings that are not confirmed or rescheduled", () => {
    expect(
      classifySessionRoomBooking({ ...booking, status: "pending_payment" })
    ).toEqual({ skipped: "not_confirmed" })
    expect(
      classifySessionRoomBooking({ ...booking, status: "cancelled" })
    ).toEqual({ skipped: "not_confirmed" })
  })

  it("skips guest bookings without a member", () => {
    expect(
      classifySessionRoomBooking({ ...booking, memberUserId: null })
    ).toEqual({ skipped: "no_member" })
  })

  it("accepts a confirmed online booking and defaults unknown locale to pt", () => {
    expect(classifySessionRoomBooking(booking)).toEqual({
      ok: true,
      lang: "pt",
    })
    expect(
      classifySessionRoomBooking({
        ...booking,
        status: "rescheduled",
        language: "en",
      })
    ).toEqual({ ok: true, lang: "en" })
    expect(classifySessionRoomBooking({ ...booking, language: "fr" })).toEqual({
      ok: true,
      lang: "pt",
    })
  })
})

describe("classifyRoomLease", () => {
  it("returns the existing room name", () => {
    expect(
      classifyRoomLease({
        dailyRoomName: "eleva-booking",
        roomCreateLeaseUntil: null,
      })
    ).toEqual({ ready: "eleva-booking" })
  })

  it("skips while another worker holds the lease", () => {
    expect(
      classifyRoomLease(
        {
          dailyRoomName: null,
          roomCreateLeaseUntil: new Date("2026-10-07T16:01:00.000Z"),
        },
        new Date("2026-10-07T16:00:00.000Z")
      )
    ).toEqual({ skip: "leased" })
  })

  it("leases when the previous attempt expired", () => {
    expect(
      classifyRoomLease(
        {
          dailyRoomName: null,
          roomCreateLeaseUntil: new Date("2026-10-07T15:59:00.000Z"),
        },
        new Date("2026-10-07T16:00:00.000Z")
      )
    ).toEqual({ lease: true })
  })
})

describe("expectedRoomName", () => {
  it("uses the deterministic eleva-{bookingId} name", () => {
    const bookingId = "22222222-2222-4222-8222-222222222222"
    expect(expectedRoomName(bookingId)).toBe(`eleva-${bookingId.toLowerCase()}`)
  })
})

describe("shouldCancelUnstartedSession", () => {
  const now = new Date("2026-10-08T12:00:00.000Z")
  const future = new Date("2026-10-08T13:00:00.000Z")
  const past = new Date("2026-10-08T11:00:00.000Z")

  it("cancels scheduled sessions before startAt", () => {
    expect(
      shouldCancelUnstartedSession(
        { status: "scheduled", startsAt: future },
        now
      )
    ).toBe(true)
  })

  it("still cancels when the financial event was before startAt", () => {
    expect(
      shouldCancelUnstartedSession(
        { status: "scheduled", startsAt: past },
        new Date("2026-10-08T10:00:00.000Z")
      )
    ).toBe(true)
  })

  it("leaves sessions after startAt, live calls, and terminal statuses alone", () => {
    expect(
      shouldCancelUnstartedSession({ status: "scheduled", startsAt: past }, now)
    ).toBe(false)
    expect(
      shouldCancelUnstartedSession({ status: "live", startsAt: future }, now)
    ).toBe(false)
    expect(
      shouldCancelUnstartedSession({ status: "ended", startsAt: future }, now)
    ).toBe(false)
    expect(shouldCancelUnstartedSession(null, now)).toBe(false)
  })
})

describe("needsCancelledSessionPlaceholder", () => {
  const now = new Date("2026-10-08T12:00:00.000Z")
  const future = new Date("2026-10-08T13:00:00.000Z")
  const past = new Date("2026-10-08T11:00:00.000Z")

  it("inserts a cancelled row when the session does not exist yet", () => {
    expect(needsCancelledSessionPlaceholder(null, future, now)).toBe(true)
  })

  it("does not insert after startAt or when the session already ended", () => {
    expect(needsCancelledSessionPlaceholder(null, past, now)).toBe(false)
    expect(needsCancelledSessionPlaceholder("ended", future, now)).toBe(false)
  })
})
