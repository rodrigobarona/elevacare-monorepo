import { describe, expect, it } from "vitest"
import {
  clinicStanding,
  normalizeClinicTaxId,
  type ClinicFilingStatus,
} from "./clinic-verification"

describe("normalizeClinicTaxId", () => {
  it("drops spaces, dots and dashes and uppercases", () => {
    expect(normalizeClinicTaxId(" pt 123.456-789 ")).toBe("PT123456789")
    expect(normalizeClinicTaxId("ESB12345678")).toBe("ESB12345678")
  })

  it("answers null for what cannot be a NIF or VAT number", () => {
    for (const value of [
      "",
      "PT 12",
      "1234567",
      "PT/123456789",
      "x".repeat(33),
    ]) {
      expect(normalizeClinicTaxId(value)).toBeNull()
    }
  })
})

describe("clinicStanding", () => {
  const cases: [boolean, ClinicFilingStatus | null, string][] = [
    [false, null, "not-sent"],
    [false, "pending", "checking"],
    [false, "needs_changes", "change-needed"],
    [false, "rejected", "not-verified"],
    [true, "approved", "verified"],
    [true, null, "verified"],
    [true, "pending", "verified-checking"],
    [true, "needs_changes", "verified-change-needed"],
    [true, "rejected", "verified-new-rejected"],
  ]
  it.each(cases)(
    "verified=%s, newest filing %s → %s",
    (verified, status, standing) => {
      expect(clinicStanding(verified, status)).toBe(standing)
    }
  )

  it("never words a verified clinic as anything but verified", () => {
    for (const status of [
      null,
      "pending",
      "needs_changes",
      "approved",
      "rejected",
    ] as const) {
      expect(clinicStanding(true, status)).toMatch(/^verified/)
    }
  })
})
