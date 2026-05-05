import { describe, expect, it } from "vitest"

import {
  buildExpertFilters,
  parseSearchParams,
} from "./marketplace-search-params"

describe("parseSearchParams", () => {
  it("returns an empty object when nothing is provided", () => {
    expect(parseSearchParams({})).toEqual({})
  })

  it("accepts well-formed values", () => {
    const out = parseSearchParams({
      category: "pelvic-health",
      language: "pt",
      country: "PT",
      session: "online",
      q: "ana silva",
      page: "3",
    })
    expect(out).toEqual({
      category: "pelvic-health",
      language: "pt",
      country: "PT",
      sessionMode: "online",
      search: "ana silva",
      page: 3,
    })
  })

  it("normalises locale-style casing for codes", () => {
    const out = parseSearchParams({
      language: "PT",
      country: "pt",
    })
    expect(out.language).toBe("pt")
    expect(out.country).toBe("PT")
  })

  it("rejects unknown filter values", () => {
    const out = parseSearchParams({
      category: "Bad Slug!",
      language: "fr",
      country: "FR",
      session: "in-person",
      q: "a",
      page: "-1",
    })
    expect(out).toEqual({})
  })

  it("rejects non-numeric pages and zero", () => {
    expect(parseSearchParams({ page: "0" }).page).toBeUndefined()
    expect(parseSearchParams({ page: "abc" }).page).toBeUndefined()
  })

  it("trims free-text and enforces length bounds", () => {
    expect(parseSearchParams({ q: "  ok  " }).search).toBe("ok")
    expect(parseSearchParams({ q: "x" }).search).toBeUndefined()
    expect(parseSearchParams({ q: "x".repeat(200) }).search).toBeUndefined()
  })

  it("uses the first value when arrays are passed", () => {
    expect(parseSearchParams({ language: ["pt", "en"] }).language).toBe("pt")
  })

  it("accepts the three valid session modes", () => {
    for (const mode of ["online", "in_person", "phone"] as const) {
      expect(parseSearchParams({ session: mode }).sessionMode).toBe(mode)
    }
  })
})

describe("buildExpertFilters", () => {
  it("maps single-value params into array filters", () => {
    expect(
      buildExpertFilters({
        category: "pelvic-health",
        language: "pt",
        country: "PT",
        sessionMode: "online",
        search: "ana",
        page: 2,
      })
    ).toEqual({
      categorySlug: "pelvic-health",
      languages: ["pt"],
      countries: ["PT"],
      sessionModes: ["online"],
      search: "ana",
      page: 2,
    })
  })

  it("leaves array filters undefined when params are missing", () => {
    const out = buildExpertFilters({})
    expect(out.languages).toBeUndefined()
    expect(out.countries).toBeUndefined()
    expect(out.sessionModes).toBeUndefined()
    expect(out.categorySlug).toBeUndefined()
  })

  it("applies overrides on top of derived filters", () => {
    const out = buildExpertFilters(
      { category: "ignored" },
      { categorySlug: "forced", pageSize: 12 }
    )
    expect(out.categorySlug).toBe("forced")
    expect(out.pageSize).toBe(12)
  })
})
