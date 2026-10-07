import { describe, expect, it } from "vitest"
import {
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
