import { describe, expect, it } from "vitest"
import {
  EMPTY_INTERNAL_REPORT,
  parseInternalReport,
  serializeInternalReport,
} from "./client/internal-report"

describe("internal report body", () => {
  it("round-trips notes, suggestions, and recommendations", () => {
    const draft = {
      notes: "Pain reduced",
      suggestions: "Try the home sequence twice a day",
      recommendations: "Follow-up in two weeks",
    }
    expect(parseInternalReport(serializeInternalReport(draft))).toEqual(draft)
  })

  it("treats blank input as empty fields", () => {
    expect(parseInternalReport("")).toEqual(EMPTY_INTERNAL_REPORT)
    expect(parseInternalReport("   ")).toEqual(EMPTY_INTERNAL_REPORT)
  })

  it("keeps legacy plaintext in notes", () => {
    expect(parseInternalReport("Freeform session write-up")).toEqual({
      notes: "Freeform session write-up",
      suggestions: "",
      recommendations: "",
    })
  })
})
