import { describe, expect, it } from "vitest"
import { formatCountdown, isExpired, remainingMs } from "./countdown"

describe("reservation countdown", () => {
  it("formats remaining time as mm:ss", () => {
    expect(formatCountdown(4 * 60 * 1000 + 32 * 1000)).toBe("04:32")
    expect(formatCountdown(0)).toBe("00:00")
  })

  it("clamps past expiries to zero", () => {
    const now = Date.parse("2026-09-09T12:00:00.000Z")
    expect(remainingMs("2026-09-09T11:59:00.000Z", now)).toBe(0)
    expect(isExpired("2026-09-09T11:59:00.000Z", now)).toBe(true)
  })

  it("treats an unparsable expiry as already elapsed", () => {
    expect(remainingMs("not-a-date")).toBe(0)
    expect(isExpired("not-a-date")).toBe(true)
  })

  it("keeps a future hold alive", () => {
    const now = Date.parse("2026-09-09T12:00:00.000Z")
    expect(remainingMs("2026-09-09T12:05:00.000Z", now)).toBe(5 * 60 * 1000)
    expect(isExpired("2026-09-09T12:05:00.000Z", now)).toBe(false)
  })
})
