import { describe, expect, it } from "vitest"
import {
  afterMeetingEnded,
  appendParticipantHistory,
  deriveAttendance,
  eventTimeFromDaily,
  shouldApplyEvent,
  statusAfterAttendance,
} from "./attendance"

describe("deriveAttendance", () => {
  it("requires both expert and member for both", () => {
    expect(deriveAttendance([{ role: "expert" }, { role: "member" }])).toBe(
      "both"
    )
    expect(deriveAttendance([{ role: "expert" }])).toBe("expert_only")
    expect(deriveAttendance([{ role: "member" }])).toBe("member_only")
    expect(deriveAttendance([{ role: "delegate" }])).toBe("nobody")
    expect(deriveAttendance([])).toBe("nobody")
  })
})

describe("statusAfterAttendance", () => {
  it("marks no-show unless both sides joined", () => {
    expect(statusAfterAttendance("both")).toBe("ended")
    expect(statusAfterAttendance("expert_only")).toBe("no_show")
    expect(statusAfterAttendance("nobody")).toBe("no_show")
  })
})

describe("afterMeetingEnded", () => {
  const bookedEnd = new Date("2026-11-16T11:00:00.000Z")
  const both = [{ role: "expert" as const }, { role: "member" as const }]
  const expertOnly = [{ role: "expert" as const }]

  it("keeps the session joinable when the room empties before the booked end", () => {
    // The expert checked the room ten minutes early and left.
    expect(
      afterMeetingEnded({
        status: "live",
        participants: expertOnly,
        at: new Date("2026-11-16T09:52:00.000Z"),
        bookedEnd,
      })
    ).toEqual({ final: false, status: "scheduled" })
    // Both dropped mid-session on a bad connection.
    expect(
      afterMeetingEnded({
        status: "live",
        participants: both,
        at: new Date("2026-11-16T10:59:59.000Z"),
        bookedEnd,
      })
    ).toEqual({ final: false, status: "scheduled" })
  })

  it("closes the session from the booked end on, by who attended", () => {
    expect(
      afterMeetingEnded({
        status: "live",
        participants: both,
        at: bookedEnd,
        bookedEnd,
      })
    ).toEqual({ final: true, status: "ended", attendance: "both" })
    expect(
      afterMeetingEnded({
        status: "live",
        participants: expertOnly,
        at: new Date("2026-11-16T11:10:00.000Z"),
        bookedEnd,
      })
    ).toEqual({ final: true, status: "no_show", attendance: "expert_only" })
    expect(
      afterMeetingEnded({
        status: "scheduled",
        participants: [],
        at: new Date("2026-11-16T11:10:00.000Z"),
        bookedEnd,
      })
    ).toEqual({ final: true, status: "no_show", attendance: "nobody" })
  })

  it("never reopens or rewrites a session that is already closed", () => {
    for (const status of ["ended", "no_show", "cancelled", "completed"]) {
      for (const at of [
        "2026-11-16T10:30:00.000Z",
        "2026-11-16T11:30:00.000Z",
      ]) {
        expect(
          afterMeetingEnded({
            status,
            participants: both,
            at: new Date(at),
            bookedEnd,
          })
        ).toEqual({ final: false, status })
      }
    }
  })

  it("leaves a room that was never resolved as it is", () => {
    expect(
      afterMeetingEnded({
        status: "room_unresolved",
        participants: [],
        at: new Date("2026-11-16T10:30:00.000Z"),
        bookedEnd,
      })
    ).toEqual({ final: false, status: "room_unresolved" })
  })
})

describe("appendParticipantHistory", () => {
  it("appends a join and closes the latest matching leave", () => {
    const joined = appendParticipantHistory([], {
      role: "member",
      userId: "m1",
      at: new Date("2026-10-07T10:02:00.000Z"),
      kind: "joined",
    })
    expect(joined).toEqual([
      {
        role: "member",
        userId: "m1",
        joinedAt: "2026-10-07T10:02:00.000Z",
      },
    ])
    expect(
      appendParticipantHistory(joined, {
        role: "member",
        userId: "m1",
        at: new Date("2026-10-07T10:31:00.000Z"),
        kind: "left",
      })[0]?.leftAt
    ).toBe("2026-10-07T10:31:00.000Z")
  })
})

describe("shouldApplyEvent", () => {
  it("rejects an older event timestamp", () => {
    expect(
      shouldApplyEvent(
        new Date("2026-10-07T10:31:00.000Z"),
        new Date("2026-10-07T10:02:00.000Z")
      )
    ).toBe(false)
    expect(
      shouldApplyEvent(
        new Date("2026-10-07T10:02:00.000Z"),
        new Date("2026-10-07T10:31:00.000Z")
      )
    ).toBe(true)
    expect(
      shouldApplyEvent(
        new Date("2026-10-07T10:31:00.000Z"),
        new Date("2026-10-07T10:31:00.000Z")
      )
    ).toBe(false)
  })
})

describe("eventTimeFromDaily", () => {
  it("accepts unix seconds and milliseconds", () => {
    const seconds = eventTimeFromDaily(
      1708526032,
      new Date("2020-01-01T00:00:00.000Z")
    )
    const millis = eventTimeFromDaily(
      1708526032000,
      new Date("2020-01-01T00:00:00.000Z")
    )
    expect(seconds.getTime()).toBe(millis.getTime())
    expect(seconds.getUTCFullYear()).toBe(2024)
  })
})
