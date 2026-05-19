import { describe, expect, it } from "vitest"
import {
  computeCommissionRate,
  hasCRMAccess,
  isClinicSaaS,
  isPriorityRanked,
  isTopExpert,
  type BillingSession,
} from "./commission"

const sessionWith = (entitlements: string[]): BillingSession => ({
  entitlements,
})

describe("computeCommissionRate", () => {
  it("returns 0.15 (15%) for solo experts with no Top Expert entitlement", () => {
    expect(computeCommissionRate(sessionWith(["expert_community"]))).toBe(0.15)
  })

  it("returns 0.15 (15%) when entitlements claim is empty", () => {
    expect(computeCommissionRate(sessionWith([]))).toBe(0.15)
  })

  it("returns 0.15 (15%) when entitlements claim is undefined", () => {
    expect(computeCommissionRate({})).toBe(0.15)
  })

  it("returns 0.08 (8%) for Top Expert subscribers", () => {
    expect(computeCommissionRate(sessionWith(["expert_top"]))).toBe(0.08)
  })

  it("returns 0 (no per-booking commission) for clinic Starter", () => {
    expect(computeCommissionRate(sessionWith(["clinic_starter"]))).toBe(0)
  })

  it("returns 0 (no per-booking commission) for clinic Growth", () => {
    expect(computeCommissionRate(sessionWith(["clinic_growth"]))).toBe(0)
  })

  it("clinic SaaS takes precedence over Top Expert when both are present", () => {
    // Edge case: clinic admin who is also a Top Expert. Clinic billing
    // covers platform fees so we should NOT also charge per-booking
    // commission.
    expect(
      computeCommissionRate(sessionWith(["clinic_growth", "expert_top"]))
    ).toBe(0)
  })
})

describe("isPriorityRanked", () => {
  it("true for Top Expert", () => {
    expect(isPriorityRanked(sessionWith(["expert_top"]))).toBe(true)
  })

  it("true for clinic Growth", () => {
    expect(isPriorityRanked(sessionWith(["clinic_growth"]))).toBe(true)
  })

  it("false for clinic Starter (Growth-tier benefit only)", () => {
    expect(isPriorityRanked(sessionWith(["clinic_starter"]))).toBe(false)
  })

  it("false when no entitlements", () => {
    expect(isPriorityRanked({})).toBe(false)
  })
})

describe("hasCRMAccess", () => {
  it("granted to all paid tiers", () => {
    expect(hasCRMAccess(sessionWith(["expert_top"]))).toBe(true)
    expect(hasCRMAccess(sessionWith(["clinic_starter"]))).toBe(true)
    expect(hasCRMAccess(sessionWith(["clinic_growth"]))).toBe(true)
  })

  it("denied for free tiers", () => {
    expect(hasCRMAccess(sessionWith(["expert_community"]))).toBe(false)
    expect(hasCRMAccess(sessionWith(["member_free"]))).toBe(false)
    expect(hasCRMAccess({})).toBe(false)
  })
})

describe("isTopExpert", () => {
  it("true only for expert_top entitlement", () => {
    expect(isTopExpert(sessionWith(["expert_top"]))).toBe(true)
    expect(isTopExpert(sessionWith(["expert_community"]))).toBe(false)
    expect(isTopExpert(sessionWith(["clinic_growth"]))).toBe(false)
    expect(isTopExpert({})).toBe(false)
  })
})

describe("isClinicSaaS", () => {
  it("true for any clinic tier", () => {
    expect(isClinicSaaS(sessionWith(["clinic_starter"]))).toBe(true)
    expect(isClinicSaaS(sessionWith(["clinic_growth"]))).toBe(true)
  })

  it("false for non-clinic tiers", () => {
    expect(isClinicSaaS(sessionWith(["expert_top"]))).toBe(false)
    expect(isClinicSaaS(sessionWith(["expert_community"]))).toBe(false)
    expect(isClinicSaaS({})).toBe(false)
  })
})
