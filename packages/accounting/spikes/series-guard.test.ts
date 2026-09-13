import { describe, expect, it } from "vitest"
import { assertTestSeriesPrefix } from "./series-guard"

describe("assertTestSeriesPrefix", () => {
  it("accepts a TEST- series", () => {
    expect(() => assertTestSeriesPrefix("TEST-ELEVA-FEE")).not.toThrow()
  })

  it("refuses a missing prefix", () => {
    expect(() => assertTestSeriesPrefix(undefined)).toThrow(/TEST-/)
  })

  it("refuses the live ELEVA prefix", () => {
    expect(() => assertTestSeriesPrefix("ELEVA")).toThrow(/TEST-/)
    expect(() => assertTestSeriesPrefix("ELEVA-FEE-2026")).toThrow(/TEST-/)
  })
})
