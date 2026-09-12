import { describe, expect, it } from "vitest"
import {
  computeApplicationFee,
  computeCommissionRate,
  computeSettlement,
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

describe("computeApplicationFee", () => {
  it("uses 1500 bps for marketplace community experts", () => {
    expect(
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["expert_community"],
        buyerKind: "marketplace",
      })
    ).toEqual({ commissionBps: 1500, feeBearer: "platform" })
  })

  it("uses 800 bps for Top Expert", () => {
    expect(
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["expert_top"],
        buyerKind: "marketplace",
      })
    ).toEqual({ commissionBps: 800, feeBearer: "platform" })
  })

  it("uses a non-expired grandfathered override", () => {
    expect(
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["expert_community"],
        buyerKind: "marketplace",
        commissionOverrideBps: 1000,
        commissionOverrideExpiresAt: new Date("2099-01-01T00:00:00Z"),
        now: new Date("2026-09-12T00:00:00Z"),
      })
    ).toEqual({ commissionBps: 1000, feeBearer: "platform" })
  })

  it("ignores an expired override", () => {
    expect(
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["expert_community"],
        buyerKind: "marketplace",
        commissionOverrideBps: 1000,
        commissionOverrideExpiresAt: new Date("2020-01-01T00:00:00Z"),
        now: new Date("2026-09-12T00:00:00Z"),
      })
    ).toEqual({ commissionBps: 1500, feeBearer: "platform" })
  })

  it("rejects an out-of-range grandfathered override", () => {
    expect(() =>
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["expert_community"],
        buyerKind: "marketplace",
        commissionOverrideBps: 15_000,
        commissionOverrideExpiresAt: new Date("2099-01-01T00:00:00Z"),
        now: new Date("2026-09-12T00:00:00Z"),
      })
    ).toThrow(/commissionOverrideBps/)
  })

  it("clinic-attributed bookings are 0 bps even with Top Expert", () => {
    expect(
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["clinic_growth", "expert_top"],
        buyerKind: "clinic",
      })
    ).toEqual({ commissionBps: 0, feeBearer: "clinic" })
  })

  it("marketplace bookings keep expert commission even with clinic SaaS", () => {
    expect(
      computeApplicationFee({
        amountCents: 10_000,
        entitlements: ["clinic_growth", "expert_top"],
        buyerKind: "marketplace",
      })
    ).toEqual({ commissionBps: 800, feeBearer: "platform" })
  })

  it("rejects a negative amount", () => {
    expect(() =>
      computeApplicationFee({
        amountCents: -1,
        entitlements: ["expert_community"],
        buyerKind: "marketplace",
      })
    ).toThrow(/amountCents/)
  })
})

describe("computeSettlement (D-03 / D-04 matrix)", () => {
  it("marketplace PT B2B: 100.00 at 15% → fee 15.00 (12.20+2.80), expert 85.00", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 340,
      feeBearer: "platform",
    })
    expect(result.platformFeeGross).toBe(1500)
    expect(result.platformFeeNet).toBe(1220)
    expect(result.vatOnPlatformFee).toBe(280)
    expect(result.expertTransfer).toBe(8500)
    expect(result.paymentProcessingFee).toBe(340)
    expect(result.rounding).toBe("half-up-cents-on-fee")
    expect(result.currency).toBe("EUR")
  })

  it("rejects non-integer or out-of-range settlement inputs", () => {
    const base = {
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b" as const,
      processingFeeCents: 340,
      feeBearer: "platform" as const,
    }
    expect(() => computeSettlement({ ...base, grossCents: 10.5 })).toThrow(
      /grossCents/
    )
    expect(() => computeSettlement({ ...base, commissionBps: 15_001 })).toThrow(
      /commissionBps/
    )
    expect(() =>
      computeSettlement({ ...base, processingFeeCents: -1 })
    ).toThrow(/processingFeeCents/)
  })

  it("intra-EU reverse charge: fee 15.00 net, 0 IVA, expert 85.00", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "eu_reverse_charge",
      processingFeeCents: 340,
      feeBearer: "platform",
    })
    expect(result.platformFeeGross).toBe(1500)
    expect(result.platformFeeNet).toBe(1500)
    expect(result.vatOnPlatformFee).toBe(0)
    expect(result.expertTransfer).toBe(8500)
  })

  it("Top Expert PT B2B: 8.00 (6.50+1.50), expert 92.00", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 800,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 340,
      feeBearer: "platform",
    })
    expect(result.platformFeeGross).toBe(800)
    expect(result.platformFeeNet).toBe(650)
    expect(result.vatOnPlatformFee).toBe(150)
    expect(result.expertTransfer).toBe(9200)
  })

  it("clinic 0%: expert nets gross minus processing fee (96.60)", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 0,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 340,
      feeBearer: "clinic",
    })
    expect(result.platformFeeGross).toBe(0)
    expect(result.platformFeeNet).toBe(0)
    expect(result.vatOnPlatformFee).toBe(0)
    expect(result.expertTransfer).toBe(9660)
  })

  it("feeBearer expert deducts both commission and processing from the transfer", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 340,
      feeBearer: "expert",
    })
    expect(result.expertTransfer).toBe(8160)
  })

  it("rejects clinic feeBearer with a non-zero commission", () => {
    expect(() =>
      computeSettlement({
        grossCents: 10_000,
        commissionBps: 1500,
        vatRateBps: 2300,
        vatTreatment: "pt_b2b",
        processingFeeCents: 340,
        feeBearer: "clinic",
      })
    ).toThrow(/commissionBps 0/)
  })

  it("allocates credit notes proportionally on a half refund", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 340,
      feeBearer: "platform",
    })
    expect(result.creditNoteAllocation(5000)).toEqual({
      platformFeeGross: 750,
      platformFeeNet: 610,
      vatOnPlatformFee: 140,
      paymentProcessingFee: 170,
      expertTransfer: 4250,
    })
  })

  it("derives credit-note VAT from rounded net so net + VAT = fee gross", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1000,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 0,
      feeBearer: "platform",
    })
    const note = result.creditNoteAllocation(5000)
    expect(note.platformFeeGross).toBe(500)
    expect(note.platformFeeNet + note.vatOnPlatformFee).toBe(
      note.platformFeeGross
    )
  })

  it("cumulative partial credit notes match the original net fee", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "pt_b2b",
      processingFeeCents: 0,
      feeBearer: "platform",
    })
    const first = result.creditNoteAllocation(3333, 0)
    const second = result.creditNoteAllocation(3333, 3333)
    const third = result.creditNoteAllocation(3334, 6666)
    expect(
      first.platformFeeNet + second.platformFeeNet + third.platformFeeNet
    ).toBe(result.platformFeeNet)
    expect(
      first.platformFeeGross + second.platformFeeGross + third.platformFeeGross
    ).toBe(result.platformFeeGross)
  })

  it("eu_b2c splits VAT the same way as PT B2B", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "eu_b2c",
      processingFeeCents: 340,
      feeBearer: "platform",
    })
    expect(result.platformFeeGross).toBe(1500)
    expect(result.platformFeeNet).toBe(1220)
    expect(result.vatOnPlatformFee).toBe(280)
  })

  it("non_eu keeps the fee as net with 0 VAT", () => {
    const result = computeSettlement({
      grossCents: 10_000,
      commissionBps: 1500,
      vatRateBps: 2300,
      vatTreatment: "non_eu",
      processingFeeCents: 340,
      feeBearer: "platform",
    })
    expect(result.platformFeeGross).toBe(1500)
    expect(result.platformFeeNet).toBe(1500)
    expect(result.vatOnPlatformFee).toBe(0)
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
