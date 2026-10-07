import { describe, expect, it } from "vitest"
import {
  JOIN_LEAD_MS,
  JOIN_TRAIL_MS,
  isJoinCtaEnabled,
  isJoinWindowOpen,
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
