import { describe, expect, it } from "vitest"
import { licenceReviewState } from "./partner-applications"

describe("licenceReviewState", () => {
  it.each([
    ["approved", "pending", "pending"],
    ["active", "pending", "pending"],
    ["active", "needs_changes", "needs_changes"],
    ["active", "approved", "verified"],
    ["active", "rejected", "needs_verification"],
    ["active", null, "needs_verification"],
    ["approved", "rejected", "rejected"],
    ["approved", null, "not_submitted"],
  ] as const)(
    "%s profile, %s application: %s",
    (profile, application, state) => {
      expect(licenceReviewState(profile, application)).toBe(state)
    }
  )
})
