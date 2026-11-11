import { describe, expect, it } from "vitest"
import {
  JOIN_LEAD_MS,
  JOIN_TRAIL_MS,
  isJoinCtaEnabled,
  isJoinStillAhead,
  isJoinWindowOpen,
  isOvertime,
} from "./join-window"

const START = new Date("2026-10-08T12:00:00.000Z")
const END = new Date("2026-10-08T13:00:00.000Z")

describe("isJoinWindowOpen", () => {
  it("opens 15 minutes before start and stays open 30 minutes after end", () => {
    expect(
      isJoinWindowOpen(START, END, new Date(START.getTime() - JOIN_LEAD_MS))
    ).toBe(true)
    expect(
      isJoinWindowOpen(START, END, new Date(START.getTime() - JOIN_LEAD_MS - 1))
    ).toBe(false)
    expect(
      isJoinWindowOpen(START, END, new Date(END.getTime() + JOIN_TRAIL_MS))
    ).toBe(true)
    expect(
      isJoinWindowOpen(START, END, new Date(END.getTime() + JOIN_TRAIL_MS + 1))
    ).toBe(false)
  })
})

describe("isJoinCtaEnabled", () => {
  const base = {
    sessionMode: "online",
    status: "confirmed",
    startsAt: START,
    endsAt: END,
    now: START,
  }

  it("enables only confirmed or rescheduled online sessions in the window", () => {
    expect(isJoinCtaEnabled(base)).toBe(true)
    expect(isJoinCtaEnabled({ ...base, status: "rescheduled" })).toBe(true)
    expect(isJoinCtaEnabled({ ...base, status: "cancelled" })).toBe(false)
    expect(isJoinCtaEnabled({ ...base, sessionMode: "phone" })).toBe(false)
    expect(
      isJoinCtaEnabled({
        ...base,
        now: new Date(START.getTime() - JOIN_LEAD_MS - 1),
      })
    ).toBe(false)
  })
})

describe("isJoinStillAhead", () => {
  const early = new Date(START.getTime() - JOIN_LEAD_MS - 1)
  const base = {
    sessionMode: "online",
    status: "confirmed",
    startsAt: START,
    now: early,
  }

  it("is true only before the join window of a joinable online session", () => {
    expect(isJoinStillAhead(base)).toBe(true)
    expect(isJoinStillAhead({ ...base, status: "rescheduled" })).toBe(true)
    // Open, or over: the hint would no longer be true.
    expect(
      isJoinStillAhead({
        ...base,
        now: new Date(START.getTime() - JOIN_LEAD_MS),
      })
    ).toBe(false)
    expect(
      isJoinStillAhead({
        ...base,
        now: new Date(END.getTime() + JOIN_TRAIL_MS + 1),
      })
    ).toBe(false)
  })

  it("is false for sessions nobody can join", () => {
    for (const status of ["completed", "cancelled", "awaiting_confirmation"]) {
      expect(isJoinStillAhead({ ...base, status })).toBe(false)
    }
    expect(isJoinStillAhead({ ...base, sessionMode: "phone" })).toBe(false)
  })
})

describe("isOvertime", () => {
  it("flips at the booked end, not at room close", () => {
    const end = END.toISOString()
    expect(isOvertime(end, END.getTime() - 1)).toBe(false)
    expect(isOvertime(end, END.getTime())).toBe(true)
    expect(isOvertime(end, END.getTime() + JOIN_TRAIL_MS)).toBe(true)
  })

  it("never shows for an unparseable end", () => {
    expect(isOvertime("not-a-date", Date.now())).toBe(false)
  })
})
