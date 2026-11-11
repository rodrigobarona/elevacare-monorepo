import { describe, expect, it } from "vitest"
import {
  REFRESH_AFTER_MS,
  sessionKind,
  shouldRefreshOnReturn,
  weekData,
  weekRangeKey,
} from "./week-data"

const thisWeek = weekRangeKey(
  "2026-11-09T00:00:00.000Z",
  "2026-11-16T00:00:00.000Z"
)
const nextWeek = weekRangeKey(
  "2026-11-16T00:00:00.000Z",
  "2026-11-23T00:00:00.000Z"
)
const request = { id: "r", status: "awaiting_confirmation" }
const session = { id: "s", status: "confirmed" }
const none = { failedKey: null, settled: {} }

describe("weekData", () => {
  it("is loading until this week has an answer", () => {
    expect(weekData({ rangeKey: thisWeek, loaded: null, ...none })).toEqual({
      failed: false,
      loading: true,
      hasWeek: false,
      bookings: [],
    })
  })

  it("does not show another week's sessions as this week's", () => {
    const data = weekData({
      rangeKey: nextWeek,
      loaded: { key: thisWeek, bookings: [session] },
      ...none,
    })
    expect(data).toEqual({
      failed: false,
      loading: true,
      hasWeek: false,
      bookings: [],
    })
  })

  it("shows the week once loaded, even when it is empty", () => {
    expect(
      weekData({
        rangeKey: thisWeek,
        loaded: { key: thisWeek, bookings: [] },
        ...none,
      })
    ).toEqual({ failed: false, loading: false, hasWeek: true, bookings: [] })
  })

  it("says a failed load failed, and is not loading", () => {
    const data = weekData({
      rangeKey: thisWeek,
      loaded: null,
      failedKey: thisWeek,
      settled: {},
    })
    expect(data).toMatchObject({ failed: true, loading: false })
  })

  it("keeps a loaded week on screen when loading it again fails", () => {
    const data = weekData({
      rangeKey: thisWeek,
      loaded: { key: thisWeek, bookings: [session] },
      failedKey: thisWeek,
      settled: {},
    })
    expect(data).toEqual({
      failed: true,
      loading: false,
      hasWeek: true,
      bookings: [session],
    })
  })

  it("ignores a failure that belongs to another week", () => {
    const data = weekData({
      rangeKey: thisWeek,
      loaded: null,
      failedKey: nextWeek,
      settled: {},
    })
    expect(data).toMatchObject({ failed: false, loading: true })
  })

  it("confirms an accepted request and removes a declined one", () => {
    const loaded = { key: thisWeek, bookings: [request, session] }
    expect(
      weekData({
        rangeKey: thisWeek,
        loaded,
        failedKey: null,
        settled: { r: "confirmed" },
      }).bookings
    ).toEqual([{ id: "r", status: "confirmed" }, session])
    expect(
      weekData({
        rangeKey: thisWeek,
        loaded,
        failedKey: null,
        settled: { r: "cancelled" },
      }).bookings
    ).toEqual([session])
  })
})

describe("sessionKind", () => {
  it("tells a request and an unpaid hold from a session", () => {
    expect(sessionKind("awaiting_confirmation")).toBe("request")
    for (const status of [
      "slot_reserved",
      "awaiting_payment",
      "reserved",
      "pending_payment",
    ]) {
      expect(sessionKind(status)).toBe("unpaid")
    }
    for (const status of ["confirmed", "rescheduled", "completed"]) {
      expect(sessionKind(status)).toBe("session")
    }
  })
})

describe("shouldRefreshOnReturn", () => {
  it("reloads a week that has been open for a while, when the page is seen", () => {
    const loadedAt = 1_000_000
    const later = loadedAt + REFRESH_AFTER_MS
    expect(
      shouldRefreshOnReturn({
        visible: true,
        lastLoadedAt: loadedAt,
        now: later,
      })
    ).toBe(true)
    expect(
      shouldRefreshOnReturn({
        visible: true,
        lastLoadedAt: loadedAt,
        now: later - 1,
      })
    ).toBe(false)
    expect(
      shouldRefreshOnReturn({
        visible: false,
        lastLoadedAt: loadedAt,
        now: later,
      })
    ).toBe(false)
    expect(
      shouldRefreshOnReturn({ visible: true, lastLoadedAt: null, now: later })
    ).toBe(false)
  })
})
