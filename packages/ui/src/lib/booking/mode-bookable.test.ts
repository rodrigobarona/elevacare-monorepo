import { describe, expect, it } from "vitest"
import {
  assertModeBookable,
  bookableModes,
  shouldSkipMeetStep,
} from "./mode-bookable"

const base = {
  active: true,
  countryScopeType: "worldwide" as const,
  countryScopeCodes: [] as string[],
  languages: ["en", "pt"],
  memberCountry: "PT",
  language: "en",
}

describe("assertModeBookable", () => {
  it("allows a worldwide mode in a supported language", () => {
    expect(assertModeBookable(base)).toEqual({ ok: true })
  })

  it("rejects an inactive mode", () => {
    expect(assertModeBookable({ ...base, active: false })).toEqual({
      ok: false,
      error: "MODE_INACTIVE",
    })
  })

  it("rejects a country outside the list scope", () => {
    expect(
      assertModeBookable({
        ...base,
        countryScopeType: "list",
        countryScopeCodes: ["PT", "ES"],
        memberCountry: "BR",
      })
    ).toEqual({ ok: false, error: "MODE_NOT_AVAILABLE_IN_COUNTRY" })
  })

  it("rejects an unsupported language", () => {
    expect(assertModeBookable({ ...base, language: "de" })).toEqual({
      ok: false,
      error: "MODE_LANGUAGE_MISMATCH",
    })
  })

  it("matches a regional language tag to its primary", () => {
    expect(assertModeBookable({ ...base, language: "pt-BR" })).toEqual({
      ok: true,
    })
  })
})

describe("shouldSkipMeetStep", () => {
  const video = {
    id: "video",
    countryScopeType: "worldwide" as const,
    countryScopeCodes: [],
    languages: ["en"],
  }
  const phone = {
    id: "phone",
    countryScopeType: "list" as const,
    countryScopeCodes: ["PT"],
    languages: ["pt"],
  }

  it("skips when exactly one mode is bookable", () => {
    expect(
      shouldSkipMeetStep([video, phone], {
        memberCountry: "US",
        language: "en",
      })?.id
    ).toBe("video")
  })

  it("does not skip when two modes are bookable", () => {
    expect(
      shouldSkipMeetStep(
        [video, { ...phone, countryScopeType: "worldwide", languages: ["en"] }],
        { memberCountry: "PT", language: "en" }
      )
    ).toBeNull()
  })

  it("does not skip when none are bookable", () => {
    expect(
      bookableModes([phone], { memberCountry: "US", language: "en" })
    ).toEqual([])
    expect(
      shouldSkipMeetStep([phone], { memberCountry: "US", language: "en" })
    ).toBeNull()
  })
})
