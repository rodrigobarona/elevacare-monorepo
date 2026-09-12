import { describe, expect, it } from "vitest"
import {
  applyHoldSet,
  clearHoldSet,
  computeEligibleAt,
  cumulativeReversalCents,
  evaluateRefundPolicy,
  needsPayoutApproval,
  snapToNext0400Lisbon,
} from "./payout-math"

describe("needsPayoutApproval", () => {
  it("is inclusive at the 50000 cent threshold", () => {
    expect(
      needsPayoutApproval({
        amountCents: 50_000,
        isFirstPayoutForAccount: false,
        thresholdCents: 50_000,
      })
    ).toBe(true)
    expect(
      needsPayoutApproval({
        amountCents: 49_999,
        isFirstPayoutForAccount: false,
        thresholdCents: 50_000,
      })
    ).toBe(false)
  })

  it("requires approval for the first payout of an account", () => {
    expect(
      needsPayoutApproval({
        amountCents: 1,
        isFirstPayoutForAccount: true,
        thresholdCents: 50_000,
      })
    ).toBe(true)
  })
})

describe("computeEligibleAt / Lisbon snap", () => {
  it("snaps max(paid+7d, sessionEnd+24h) to next 04:00 Europe/Lisbon", () => {
    const paidAt = new Date("2026-01-01T10:00:00.000Z")
    const sessionEnd = new Date("2026-01-02T10:00:00.000Z")
    expect(computeEligibleAt(paidAt, sessionEnd).toISOString()).toBe(
      "2026-01-09T04:00:00.000Z"
    )
  })

  it("snaps across the 2026 spring-forward DST boundary", () => {
    const before = new Date("2026-03-28T05:00:00.000Z")
    expect(snapToNext0400Lisbon(before).toISOString()).toBe(
      "2026-03-29T03:00:00.000Z"
    )
  })

  it("snaps across the 2026 autumn DST fallback", () => {
    const afterFallback = new Date("2026-10-25T04:30:00.000Z")
    expect(snapToNext0400Lisbon(afterFallback).toISOString()).toBe(
      "2026-10-26T04:00:00.000Z"
    )
  })
})

describe("hold set", () => {
  it("stays held until both dispute and manual are cleared (dispute then manual)", () => {
    const first = applyHoldSet({
      holdReasons: [],
      status: "scheduled",
      heldFromStatus: null,
      reason: "dispute",
    })
    expect(first).toEqual({
      holdReasons: ["dispute"],
      status: "held",
      heldFromStatus: "scheduled",
    })
    const second = applyHoldSet({
      holdReasons: first.holdReasons,
      status: first.status,
      heldFromStatus: first.heldFromStatus,
      reason: "manual",
    })
    expect(second.status).toBe("held")
    expect(second.heldFromStatus).toBe("scheduled")
    const afterDispute = clearHoldSet({
      holdReasons: second.holdReasons,
      heldFromStatus: second.heldFromStatus,
      reason: "dispute",
    })
    expect(afterDispute.status).toBe("held")
    expect(afterDispute.remaining).toEqual(["manual"])
    const afterManual = clearHoldSet({
      holdReasons: afterDispute.holdReasons,
      heldFromStatus: afterDispute.heldFromStatus,
      reason: "manual",
    })
    expect(afterManual).toEqual({
      holdReasons: [],
      status: "scheduled",
      heldFromStatus: null,
      remaining: [],
    })
  })

  it("stays held until both reasons are cleared (manual then dispute)", () => {
    const first = applyHoldSet({
      holdReasons: [],
      status: "pending",
      heldFromStatus: null,
      reason: "manual",
    })
    const second = applyHoldSet({
      holdReasons: first.holdReasons,
      status: first.status,
      heldFromStatus: first.heldFromStatus,
      reason: "dispute",
    })
    expect(second.heldFromStatus).toBe("pending")
    const afterManual = clearHoldSet({
      holdReasons: second.holdReasons,
      heldFromStatus: second.heldFromStatus,
      reason: "manual",
    })
    expect(afterManual.status).toBe("held")
    const afterDispute = clearHoldSet({
      holdReasons: afterManual.holdReasons,
      heldFromStatus: afterManual.heldFromStatus,
      reason: "dispute",
    })
    expect(afterDispute.status).toBe("pending")
  })

  it("does not restore to held when heldFromStatus is missing", () => {
    const held = applyHoldSet({
      holdReasons: [],
      status: "held",
      heldFromStatus: null,
      reason: "dispute",
    })
    expect(held.heldFromStatus).toBe("pending")
    const cleared = clearHoldSet({
      holdReasons: held.holdReasons,
      heldFromStatus: held.heldFromStatus,
      reason: "dispute",
    })
    expect(cleared.status).toBe("pending")
    expect(cleared.holdReasons).toEqual([])
  })
})

describe("cumulativeReversalCents", () => {
  it("splits 33.33 + 33.33 + 33.34 on 100.00 / 85.00 without remainder", () => {
    const first = cumulativeReversalCents({
      refundedToDate: 3333,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: 0,
    })
    const second = cumulativeReversalCents({
      refundedToDate: 6666,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: first,
    })
    const third = cumulativeReversalCents({
      refundedToDate: 10_000,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: first + second,
    })
    expect([first, second, third]).toEqual([2833, 2833, 2834])
    expect(first + second + third).toBe(8500)
  })

  it("leaves 0.01 after three 33.33 refunds until the last cent is refunded", () => {
    const first = cumulativeReversalCents({
      refundedToDate: 3333,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: 0,
    })
    const second = cumulativeReversalCents({
      refundedToDate: 6666,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: first,
    })
    const third = cumulativeReversalCents({
      refundedToDate: 9999,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: first + second,
    })
    expect(first + second + third).toBe(8499)
    const leftover = cumulativeReversalCents({
      refundedToDate: 10_000,
      grossCents: 10_000,
      transferredCents: 8500,
      reversedToDate: first + second + third,
    })
    expect(leftover).toBe(1)
  })
})

describe("evaluateRefundPolicy", () => {
  it("gives a full refund when the member cancels at least 24h before start", () => {
    expect(
      evaluateRefundPolicy({ initiator: "member", hoursUntilStart: 24 })
    ).toBe("full")
  })

  it("requires review for a member cancel inside 24h and for no-shows", () => {
    expect(
      evaluateRefundPolicy({ initiator: "member", hoursUntilStart: 23 })
    ).toBe("requires_review")
    expect(
      evaluateRefundPolicy({
        initiator: "staff",
        hoursUntilStart: 48,
        attendance: "member_no_show",
      })
    ).toBe("requires_review")
  })

  it("gives a full refund when the expert cancels", () => {
    expect(
      evaluateRefundPolicy({ initiator: "expert", hoursUntilStart: 1 })
    ).toBe("full")
  })
})
