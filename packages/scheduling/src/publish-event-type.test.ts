import { describe, expect, it } from "vitest"

import { publishEventType } from "./publish-event-type"

const baseProfile = {
  kind: "non_clinical" as const,
  hasPublicHandle: true,
  worldwideRemote: true,
  serviceCountries: ["PT", "ES"],
  profileLanguages: ["en", "pt"],
}

describe("publishEventType", () => {
  it("rejects when there is no active mode", () => {
    const result = publishEventType({
      ...baseProfile,
      modes: [
        {
          modeId: "m1",
          mode: "online",
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: ["en"],
          locationCountry: null,
          active: false,
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "NO_ACTIVE_MODE")).toBe(
        true
      )
    }
  })

  it("rejects when the public handle is missing", () => {
    const result = publishEventType({
      ...baseProfile,
      hasPublicHandle: false,
      modes: [
        {
          modeId: "m1",
          mode: "online",
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: ["en"],
          locationCountry: null,
          active: true,
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "MISSING_PUBLIC_HANDLE")
      ).toBe(true)
    }
  })

  it("rejects clinical worldwide modes", () => {
    const result = publishEventType({
      ...baseProfile,
      kind: "clinical",
      modes: [
        {
          modeId: "m1",
          mode: "online",
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: ["en"],
          locationCountry: null,
          active: true,
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations[0]?.code).toBe("CLINICAL_WORLDWIDE")
    }
  })

  it("accepts a valid non-clinical worldwide video mode", () => {
    const result = publishEventType({
      ...baseProfile,
      modes: [
        {
          modeId: "m1",
          mode: "online",
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: ["en", "pt"],
          locationCountry: null,
          active: true,
        },
      ],
    })
    expect(result).toEqual({ ok: true })
  })
})
