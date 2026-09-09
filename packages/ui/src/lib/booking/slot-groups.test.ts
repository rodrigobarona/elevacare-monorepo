import { describe, expect, it } from "vitest"
import {
  calendarDays,
  dateKeyInZone,
  groupSlotsByDay,
  startOfMonth,
} from "./slot-groups"

describe("dateKeyInZone", () => {
  it("keeps a Lisbon afternoon on the same civil day", () => {
    expect(dateKeyInZone("2026-09-15T14:00:00.000Z", "Europe/Lisbon")).toBe(
      "2026-09-15"
    )
  })

  it("rolls a late UTC slot into the next Sao Paulo day", () => {
    expect(dateKeyInZone("2026-09-16T02:30:00.000Z", "America/Sao_Paulo")).toBe(
      "2026-09-15"
    )
  })
})

describe("groupSlotsByDay", () => {
  it("groups and sorts slots by civil day in the member timezone", () => {
    const groups = groupSlotsByDay(
      [
        { start: "2026-09-16T09:00:00.000Z", end: "2026-09-16T10:00:00.000Z" },
        { start: "2026-09-15T14:00:00.000Z", end: "2026-09-15T15:00:00.000Z" },
        { start: "2026-09-16T08:00:00.000Z", end: "2026-09-16T09:00:00.000Z" },
      ],
      "Europe/Lisbon"
    )
    expect(groups.map((group) => group.dateKey)).toEqual([
      "2026-09-15",
      "2026-09-16",
    ])
    expect(groups[1]?.slots.map((slot) => slot.start)).toEqual([
      "2026-09-16T08:00:00.000Z",
      "2026-09-16T09:00:00.000Z",
    ])
  })
})

describe("calendarDays", () => {
  it("returns a Monday-first 42-day grid", () => {
    const days = calendarDays(
      startOfMonth(new Date("2026-09-01T00:00:00.000Z"))
    )
    expect(days).toHaveLength(42)
    expect(days[0]?.getUTCDay()).toBe(1)
  })
})
