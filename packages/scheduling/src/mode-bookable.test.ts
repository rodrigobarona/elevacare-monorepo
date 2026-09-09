import { describe, expect, it } from "vitest"
import { assertModeBookable } from "./mode-bookable"

const base = {
  active: true,
  countryScopeType: "list" as const,
  countryScopeCodes: ["PT", "ES"],
  languages: ["pt", "en"],
  memberCountry: "PT",
  language: "pt",
}

describe("assertModeBookable", () => {
  it("accepts an active list-scoped mode for a matching country and language", () => {
    expect(assertModeBookable(base)).toEqual({ ok: true })
  })

  it("normalizes country codes before the list check", () => {
    expect(
      assertModeBookable({
        ...base,
        memberCountry: " pt ",
        countryScopeCodes: ["pt"],
      })
    ).toEqual({ ok: true })
  })

  it("accepts worldwide scope for any country", () => {
    expect(
      assertModeBookable({
        ...base,
        countryScopeType: "worldwide",
        countryScopeCodes: [],
        memberCountry: "BR",
      })
    ).toEqual({ ok: true })
  })

  it("rejects an inactive mode first", () => {
    expect(assertModeBookable({ ...base, active: false })).toEqual({
      ok: false,
      error: "MODE_INACTIVE",
    })
  })

  it("rejects a country outside the list", () => {
    expect(assertModeBookable({ ...base, memberCountry: "BR" })).toEqual({
      ok: false,
      error: "MODE_NOT_AVAILABLE_IN_COUNTRY",
    })
  })

  it("rejects an unsupported language", () => {
    expect(assertModeBookable({ ...base, language: "de" })).toEqual({
      ok: false,
      error: "MODE_LANGUAGE_MISMATCH",
    })
  })

  it("matches a retired regional tag against the primary language", () => {
    expect(assertModeBookable({ ...base, language: "pt-BR" })).toEqual({
      ok: true,
    })
  })

  it("rejects an empty languages list as a mismatch", () => {
    expect(assertModeBookable({ ...base, languages: [] })).toEqual({
      ok: false,
      error: "MODE_LANGUAGE_MISMATCH",
    })
  })
})
