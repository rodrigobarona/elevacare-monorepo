import { describe, expect, it } from "vitest"
import {
  assertTestSeriesPrefix,
  isAllowedTestSeriesPrefix,
  normalizeTestSeriesPrefix,
} from "./series-guard"

describe("isAllowedTestSeriesPrefix", () => {
  it("accepts the founder TEST series and TEST- children", () => {
    expect(isAllowedTestSeriesPrefix("TEST")).toBe(true)
    expect(isAllowedTestSeriesPrefix("TEST-ELEVA-FEE")).toBe(true)
    expect(isAllowedTestSeriesPrefix(" TEST ")).toBe(true)
    expect(normalizeTestSeriesPrefix(" TEST ")).toBe("TEST")
  })

  it("refuses live and unrelated prefixes", () => {
    expect(isAllowedTestSeriesPrefix("ELEVA")).toBe(false)
    expect(isAllowedTestSeriesPrefix("ELEVA-FEE-2026")).toBe(false)
    expect(isAllowedTestSeriesPrefix("2026")).toBe(false)
    expect(isAllowedTestSeriesPrefix("TESTFOO")).toBe(false)
    expect(isAllowedTestSeriesPrefix("")).toBe(false)
  })
})

describe("assertTestSeriesPrefix", () => {
  it("accepts TEST and TEST- series", () => {
    expect(() => assertTestSeriesPrefix("TEST")).not.toThrow()
    expect(() => assertTestSeriesPrefix("TEST-ELEVA-FEE")).not.toThrow()
  })

  it("refuses a missing prefix", () => {
    expect(() => assertTestSeriesPrefix(undefined)).toThrow(/TEST/)
  })

  it("refuses the live ELEVA prefix", () => {
    expect(() => assertTestSeriesPrefix("ELEVA")).toThrow(/TEST/)
    expect(() => assertTestSeriesPrefix("ELEVA-FEE-2026")).toThrow(/TEST/)
  })
})
