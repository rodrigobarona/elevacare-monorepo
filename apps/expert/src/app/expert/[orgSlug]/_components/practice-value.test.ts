import { describe, expect, it } from "vitest"
import {
  initialPracticeValue,
  isPracticeComplete,
  practicePayload,
  samePractice,
} from "./practice-value"

const PRACTICE = {
  practiceCountry: "PT",
  serviceCountries: ["PT", "ES"],
  languages: ["pt", "en"],
  worldwideRemote: false,
}

describe("practice values", () => {
  it("serves the practice country when nothing else was saved", () => {
    expect(
      initialPracticeValue({
        practiceCountry: "pt",
        serviceCountries: [],
        languages: [],
        worldwideRemote: false,
      }).serviceCountries
    ).toEqual(["PT"])
  })

  it("always sends the practice country among the served ones", () => {
    expect(
      practicePayload({ ...PRACTICE, practiceCountry: "BR" }).serviceCountries
    ).toEqual(["PT", "ES", "BR"])
  })

  it("needs a practice country and at least one language", () => {
    expect(isPracticeComplete(PRACTICE)).toBe(true)
    expect(isPracticeComplete({ ...PRACTICE, languages: [] })).toBe(false)
    expect(isPracticeComplete({ ...PRACTICE, practiceCountry: "" })).toBe(false)
  })

  it("ignores order when deciding whether anything changed", () => {
    expect(
      samePractice(PRACTICE, {
        ...PRACTICE,
        serviceCountries: ["ES", "PT"],
        languages: ["en", "pt"],
      })
    ).toBe(true)
    expect(samePractice(PRACTICE, { ...PRACTICE, worldwideRemote: true })).toBe(
      false
    )
  })
})
