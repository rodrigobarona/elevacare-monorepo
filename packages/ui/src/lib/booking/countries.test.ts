import { describe, expect, it } from "vitest"
import { countryOptions, normalizeCountry } from "./countries"

describe("normalizeCountry", () => {
  it("uppercases a valid ISO code", () => {
    expect(normalizeCountry("pt")).toBe("PT")
  })

  it("falls back to Portugal for junk", () => {
    expect(normalizeCountry("Portugal")).toBe("PT")
    expect(normalizeCountry("ZZ")).toBe("PT")
    expect(normalizeCountry(null)).toBe("PT")
  })
})

describe("countryOptions", () => {
  it("includes extra scope codes and sorts by local name", () => {
    const options = countryOptions("en", ["JP"])
    expect(options.some((option) => option.code === "JP")).toBe(true)
    expect(options.some((option) => option.code === "PT")).toBe(true)
    const labels = options.map((option) => option.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")))
  })
})
