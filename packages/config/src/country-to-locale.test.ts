import { describe, expect, it } from "vitest"
import { countryToLocale } from "./country-to-locale"

describe("countryToLocale", () => {
  it("maps PT + BR to pt", () => {
    expect(countryToLocale("PT")).toBe("pt")
    expect(countryToLocale("BR")).toBe("pt")
    expect(countryToLocale("pt")).toBe("pt")
  })

  it("maps Spanish-speaking markets to es", () => {
    expect(countryToLocale("ES")).toBe("es")
    expect(countryToLocale("MX")).toBe("es")
    expect(countryToLocale("AR")).toBe("es")
  })

  it("falls back to default locale for unknown or missing country", () => {
    expect(countryToLocale(undefined)).toBe("en")
    expect(countryToLocale(null)).toBe("en")
    expect(countryToLocale("US")).toBe("en")
    expect(countryToLocale("DE")).toBe("en")
    expect(countryToLocale("")).toBe("en")
  })
})
