import { describe, expect, it } from "vitest"
import {
  CANCELLATION_POLICY_TIERS,
  CANCELLATION_POLICY_VALUES,
  describeCancellationPolicy,
} from "./cancellation-policy"

describe("CANCELLATION_POLICY_TIERS", () => {
  it("orders every policy from full refund down to a final 0h tier", () => {
    for (const policy of CANCELLATION_POLICY_VALUES) {
      const tiers = CANCELLATION_POLICY_TIERS[policy]
      expect(tiers[0]?.refundPercent).toBe(100)
      expect(tiers.at(-1)?.minHoursBefore).toBe(0)
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i]!.minHoursBefore).toBeLessThan(
          tiers[i - 1]!.minHoursBefore
        )
        expect(tiers[i]!.refundPercent).toBeLessThan(
          tiers[i - 1]!.refundPercent
        )
      }
    }
  })
})

describe("describeCancellationPolicy", () => {
  it("renders the strict tiers in English", () => {
    expect(describeCancellationPolicy("strict", "en")).toEqual({
      name: "Strict",
      lines: [
        "Full refund if you cancel at least 7 days before the session.",
        "50% refund if you cancel between 7 days and 48 hours before.",
        "No refund if you cancel less than 48 hours before.",
        "Free cancellation within 24 hours of booking, if the session is at least 48 hours away.",
      ],
    })
  })

  it("has a line per tier plus the grace period in every locale", () => {
    for (const locale of ["en", "pt", "es"] as const) {
      for (const policy of CANCELLATION_POLICY_VALUES) {
        const { lines } = describeCancellationPolicy(policy, locale)
        expect(lines).toHaveLength(CANCELLATION_POLICY_TIERS[policy].length + 1)
      }
    }
  })
})
