import { describe, expect, it } from "vitest"
import {
  attendanceFallbackDueAt,
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
