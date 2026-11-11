import { describe, expect, it } from "vitest"
import {
  DEFAULT_HOURS,
  MIN_BLOCK_MINUTES,
  addDays,
  agendaDays,
  layoutDay,
  nowLinePct,
  spanOnDay,
  startOfWeek,
  visibleHours,
  type TimedItem,
} from "./calendar-layout"

// Local-time dates, so the tests hold in any time zone.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute)
const session = (id: string, start: Date, minutes: number): TimedItem => ({
  id,
  startsAt: start.toISOString(),
  endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
})

const monday = startOfWeek(at(4, 12))
const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

describe("startOfWeek", () => {
  it("is the Monday of that week at midnight", () => {
    expect(monday).toEqual(at(2, 0))
    expect(startOfWeek(at(8, 23, 59))).toEqual(at(2, 0))
    expect(startOfWeek(at(2, 0))).toEqual(at(2, 0))
  })
})

describe("spanOnDay", () => {
  it("gives the minutes of a session on its day", () => {
    expect(spanOnDay(session("a", at(4, 9, 30), 45), at(4, 0))).toEqual({
      startMin: 9 * 60 + 30,
      endMin: 10 * 60 + 15,
    })
    expect(spanOnDay(session("a", at(4, 9, 30), 45), at(5, 0))).toBeNull()
  })

  it("splits a session that crosses midnight", () => {
    const late = session("a", at(4, 23, 30), 60)
    expect(spanOnDay(late, at(4, 0))).toEqual({
      startMin: 23 * 60 + 30,
      endMin: 24 * 60,
    })
    expect(spanOnDay(late, at(5, 0))).toEqual({ startMin: 0, endMin: 30 })
  })

  it("keeps a session that ends at midnight on its own day", () => {
    const untilMidnight = session("a", at(4, 23, 0), 60)
    expect(spanOnDay(untilMidnight, at(4, 0))?.endMin).toBe(24 * 60)
    expect(spanOnDay(untilMidnight, at(5, 0))).toBeNull()
  })
})

describe("visibleHours", () => {
  it("shows the working day when every session is inside it", () => {
    expect(visibleHours([], week)).toEqual(DEFAULT_HOURS)
    expect(visibleHours([session("a", at(4, 9), 60)], week)).toEqual(
      DEFAULT_HOURS
    )
  })

  it("widens for a session before 07:00 or after 21:00", () => {
    expect(visibleHours([session("a", at(4, 6, 30), 60)], week)).toEqual({
      start: 6,
      end: 21,
    })
    expect(visibleHours([session("a", at(4, 21, 15), 45)], week)).toEqual({
      start: 7,
      end: 22,
    })
  })

  it("shows the whole day for a session across midnight", () => {
    expect(visibleHours([session("a", at(4, 23, 30), 60)], week)).toEqual({
      start: 0,
      end: 24,
    })
  })

  it("leaves room for the drawn height of a short late session", () => {
    // 20:55 for 5 minutes is drawn taller than it lasts: past 21:00.
    expect(visibleHours([session("a", at(4, 20, 55), 5)], week).end).toBe(22)
  })

  it("ignores sessions of other weeks", () => {
    expect(visibleHours([session("a", at(12, 5), 60)], week)).toEqual(
      DEFAULT_HOURS
    )
  })
})

describe("layoutDay", () => {
  const hours = { start: 7, end: 21 } // 840 minutes

  it("puts a session at its start, as tall as it lasts", () => {
    const [block] = layoutDay([session("a", at(4, 9, 30), 90)], at(4, 0), hours)
    expect(block?.topPct).toBeCloseTo((150 / 840) * 100)
    expect(block?.heightPct).toBeCloseTo((90 / 840) * 100)
    expect(block).toMatchObject({ lane: 0, lanes: 1, drawnMinutes: 90 })
  })

  it("leaves other days' sessions out", () => {
    expect(layoutDay([session("a", at(5, 9), 60)], at(4, 0), hours)).toEqual([])
  })

  it("gives a very short session a readable height", () => {
    const [block] = layoutDay([session("a", at(4, 9), 5)], at(4, 0), hours)
    expect(block?.drawnMinutes).toBe(MIN_BLOCK_MINUTES)
  })

  it("sets overlapping sessions side by side", () => {
    const blocks = layoutDay(
      [
        session("a", at(4, 9), 60),
        session("b", at(4, 9, 30), 60),
        session("c", at(4, 11), 30),
      ],
      at(4, 0),
      hours
    )
    const byId = Object.fromEntries(blocks.map((b) => [b.item.id, b]))
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 })
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 })
    // Later and clear of both: full width again.
    expect(byId.c).toMatchObject({ lane: 0, lanes: 1 })
  })

  it("reuses a lane once its session has ended", () => {
    const blocks = layoutDay(
      [
        session("a", at(4, 9), 120),
        session("b", at(4, 9), 30),
        session("c", at(4, 10), 30),
      ],
      at(4, 0),
      hours
    )
    const byId = Object.fromEntries(blocks.map((b) => [b.item.id, b]))
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 })
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 })
    expect(byId.c).toMatchObject({ lane: 1, lanes: 2 })
  })

  it("back-to-back sessions do not share the width", () => {
    const blocks = layoutDay(
      [session("a", at(4, 9), 60), session("b", at(4, 10), 60)],
      at(4, 0),
      hours
    )
    expect(blocks.map((b) => b.lanes)).toEqual([1, 1])
  })

  it("marks the two halves of a session across midnight", () => {
    const late = session("a", at(4, 23), 120)
    const allDay = { start: 0, end: 24 }
    const [first] = layoutDay([late], at(4, 0), allDay)
    const [second] = layoutDay([late], at(5, 0), allDay)
    expect(first).toMatchObject({
      continuesFromBefore: false,
      continuesAfter: true,
    })
    expect(first?.topPct).toBeCloseTo((23 / 24) * 100)
    expect(second).toMatchObject({
      continuesFromBefore: true,
      continuesAfter: false,
    })
    expect(second?.topPct).toBe(0)
  })

  it("never draws past the end of the grid", () => {
    const [block] = layoutDay([session("a", at(4, 20, 55), 5)], at(4, 0), hours)
    expect((block?.topPct ?? 0) + (block?.heightPct ?? 0)).toBeCloseTo(100)
    expect(block?.drawnMinutes).toBe(MIN_BLOCK_MINUTES)
  })
})

describe("times that cannot be trusted", () => {
  const hours = { start: 7, end: 21 }

  it("shows a session with no length on the day it starts", () => {
    const [block] = layoutDay([session("a", at(4, 9), 0)], at(4, 0), hours)
    expect(block?.drawnMinutes).toBe(MIN_BLOCK_MINUTES)
  })

  it("shows a session that ends before it starts as a short block", () => {
    const reversed = {
      id: "a",
      startsAt: at(4, 10).toISOString(),
      endsAt: at(4, 9).toISOString(),
    }
    const [block] = layoutDay([reversed], at(4, 0), hours)
    expect(block?.topPct).toBeCloseTo((180 / 840) * 100)
    expect(block?.drawnMinutes).toBe(MIN_BLOCK_MINUTES)
    expect(layoutDay([reversed], at(5, 0), hours)).toEqual([])
  })

  it("leaves out a session whose times cannot be read", () => {
    const broken = { id: "a", startsAt: "not a date", endsAt: "" }
    expect(spanOnDay(broken, at(4, 0))).toBeNull()
    expect(layoutDay([broken], at(4, 0), hours)).toEqual([])
    expect(visibleHours([broken], week)).toEqual(DEFAULT_HOURS)
    expect(agendaDays([broken], week)).toEqual([])
  })
})

describe("agendaDays", () => {
  it("groups by start day, in time order, and skips empty days", () => {
    const days = agendaDays(
      [
        session("late", at(4, 15), 60),
        session("early", at(4, 9), 60),
        session("friday", at(6, 9), 60),
      ],
      week
    )
    expect(days.map((d) => d.day.getDate())).toEqual([4, 6])
    expect(days[0]?.items.map((i) => i.id)).toEqual(["early", "late"])
  })

  it("lists a session from the Sunday before under Monday, once", () => {
    const overnight = session("a", new Date(2026, 10, 1, 23, 30), 60)
    const days = agendaDays([overnight], week)
    expect(days.map((d) => d.day.getDate())).toEqual([2])
    expect(days[0]?.items).toHaveLength(1)
  })

  it("lists a session across midnight only on the day it starts", () => {
    const days = agendaDays([session("a", at(4, 23, 30), 60)], week)
    expect(days.map((d) => d.day.getDate())).toEqual([4])
  })
})

describe("nowLinePct", () => {
  it("is where the current time sits, or null outside the hours shown", () => {
    const hours = { start: 7, end: 21 }
    expect(nowLinePct(at(4, 14), hours)).toBeCloseTo(50)
    expect(nowLinePct(at(4, 6, 59), hours)).toBeNull()
    expect(nowLinePct(at(4, 22), hours)).toBeNull()
  })
})
