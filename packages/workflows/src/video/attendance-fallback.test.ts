import { describe, expect, it } from "vitest"
import {
  attendanceFallbackDueAt,
  fallbackOutcome,
  shouldFinalizeAttendanceFallback,
} from "./attendance-fallback"

describe("attendanceFallbackDueAt", () => {
  it("matches the Eleva join-window trail (endsAt + 30m)", () => {
    const endsAt = new Date("2026-10-08T10:00:00.000Z")
    expect(attendanceFallbackDueAt(endsAt).toISOString()).toBe(
      "2026-10-08T10:30:00.000Z"
    )
  })
})

describe("shouldFinalizeAttendanceFallback", () => {
  const endsAt = new Date("2026-10-08T10:00:00.000Z")
  const beforeDue = new Date("2026-10-08T10:29:59.000Z")
  const due = new Date("2026-10-08T10:30:00.000Z")

  it("finalizes scheduled sessions with no attendance after the join window closes", () => {
    expect(
      shouldFinalizeAttendanceFallback(
        { status: "scheduled", attendance: null, endsAt },
        due
      )
    ).toBe(true)
    expect(
      shouldFinalizeAttendanceFallback(
        { status: "live", attendance: null, endsAt },
        due
      )
    ).toBe(true)
  })

  it("waits for the join-window trail and skips finalized or cancelled rows", () => {
    expect(
      shouldFinalizeAttendanceFallback(
        { status: "scheduled", attendance: null, endsAt },
        beforeDue
      )
    ).toBe(false)
    expect(
      shouldFinalizeAttendanceFallback(
        { status: "scheduled", attendance: "nobody", endsAt },
        due
      )
    ).toBe(false)
    expect(
      shouldFinalizeAttendanceFallback(
        { status: "ended", attendance: null, endsAt },
        due
      )
    ).toBe(false)
    expect(
      shouldFinalizeAttendanceFallback(
        { status: "cancelled", attendance: null, endsAt },
        due
      )
    ).toBe(false)
  })
})

describe("fallbackOutcome", () => {
  const booked = {
    start: new Date("2026-10-08T09:00:00.000Z"),
    end: new Date("2026-10-08T10:00:00.000Z"),
  }
  const now = new Date("2026-10-08T10:30:00.000Z")

  it("records nobody for a video session whose room stayed empty", () => {
    expect(
      fallbackOutcome({ sessionMode: "online", participants: [], booked, now })
    ).toEqual({ status: "no_show", attendance: "nobody" })
  })

  it("reads who came from the room for a video session", () => {
    const together = [
      {
        role: "expert" as const,
        joinedAt: "2026-10-08T09:00:00.000Z",
        leftAt: "2026-10-08T09:50:00.000Z",
      },
      {
        role: "member" as const,
        joinedAt: "2026-10-08T09:01:00.000Z",
        leftAt: "2026-10-08T09:50:00.000Z",
      },
    ]
    expect(
      fallbackOutcome({
        sessionMode: "online",
        participants: together,
        booked,
        now,
      })
    ).toEqual({ status: "ended", attendance: "both" })
  })

  it("never calls a phone or in-person session a no-show", () => {
    // Nobody is ever in a video room for these: an empty room says nothing
    // about whether the two met.
    for (const sessionMode of ["phone", "in_person"]) {
      expect(
        fallbackOutcome({ sessionMode, participants: [], booked, now })
      ).toEqual({ status: "ended", attendance: null })
    }
  })
})
