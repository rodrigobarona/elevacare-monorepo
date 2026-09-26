import { describe, expect, it } from "vitest"
import {
  applyHoldSet,
  clearHoldSet,
  computeEligibleAt,
  cumulativeReversalCents,
  evaluateRefundPolicy,
  initialPayoutState,
  isDefinitiveStripeRejection,
  needsPayoutApproval,
  nextPayoutStatusAfterRefund,
  nextPayoutStatusAfterTransferReversed,
  paymentStatusAfterRefund,
  snapToNext0400Lisbon,
  transferBlockReason,
  isInFlightIdempotencyConflict,
} from "./payout-math"

describe("transferBlockReason", () => {
  const ok = {
    paymentStatus: "succeeded",
    disputeStatus: "none",
    bookingStatus: "completed",
    refundDueCents: null,
    refundedCents: 0,
  }

  it("allows a succeeded, undisputed, delivered booking", () => {
    expect(transferBlockReason(ok)).toBeNull()
  })

  it.each(["refund_pending", "refunded", "failed"])(
    "blocks when the payment is %s",
    (paymentStatus) => {
      expect(transferBlockReason({ ...ok, paymentStatus })).toBe(
        "payment_not_succeeded"
      )
    }
  )

  it("blocks while a dispute is open", () => {
    expect(transferBlockReason({ ...ok, disputeStatus: "open" })).toBe(
      "dispute_open"
    )
  })

  it.each(["cancelled", "refunded"])(
    "blocks a %s booking even if the payment flip was missed",
    (bookingStatus) => {
      expect(transferBlockReason({ ...ok, bookingStatus })).toBe(
        "booking_cancelled"
      )
    }
  )

  it("pays the retained share once a policy cancellation is settled", () => {
    expect(
      transferBlockReason({
        ...ok,
        bookingStatus: "cancelled",
        refundDueCents: 3000,
        refundedCents: 3000,
      })
    ).toBeNull()
    expect(
      transferBlockReason({
        ...ok,
        bookingStatus: "cancelled",
        refundDueCents: 0,
        refundedCents: 0,
      })
    ).toBeNull()
  })

  it("blocks a policy cancellation whose refund has not landed", () => {
    expect(
      transferBlockReason({
        ...ok,
        bookingStatus: "cancelled",
        refundDueCents: 3000,
        refundedCents: 0,
      })
    ).toBe("booking_cancelled")
  })
})

describe("paymentStatusAfterRefund", () => {
  const base = { amountCents: 6000, refundDueCents: 3000 }

  it("marks a fully refunded payment refunded", () => {
    expect(
      paymentStatusAfterRefund({
        ...base,
        status: "refund_pending",
        refundedCents: 6000,
      })
    ).toBe("refunded")
  })

  it("returns a settled partial cancellation refund to succeeded", () => {
    expect(
      paymentStatusAfterRefund({
        ...base,
        status: "refund_pending",
        refundedCents: 3000,
      })
    ).toBe("succeeded")
  })

  it("keeps refund_pending until the due amount is reached", () => {
    expect(
      paymentStatusAfterRefund({
        ...base,
        status: "refund_pending",
        refundedCents: 1000,
      })
    ).toBe("refund_pending")
    expect(
      paymentStatusAfterRefund({
        amountCents: 6000,
        refundDueCents: null,
        status: "refund_pending",
        refundedCents: 3000,
      })
    ).toBe("refund_pending")
  })
})

describe("isDefinitiveStripeRejection", () => {
  it("treats 4xx invalid-request errors as definitive", () => {
    expect(
      isDefinitiveStripeRejection({
        type: "StripeInvalidRequestError",
        statusCode: 400,
        code: "balance_insufficient",
      })
    ).toBe(true)
  })

  it.each([
    { type: "StripeIdempotencyError", statusCode: 400 },
    { code: "idempotency_error", statusCode: 409 },
    { code: "lock_timeout", statusCode: 400 },
    { type: "StripeRateLimitError", statusCode: 429 },
    { type: "StripeAPIError", statusCode: 500 },
    { type: "StripeConnectionError" },
    new Error("socket hang up"),
  ])("keeps the key for ambiguous failures (%o)", (err) => {
    expect(isDefinitiveStripeRejection(err)).toBe(false)
  })
})

describe("initialPayoutState", () => {
  const base = {
    amountCents: 8_500,
    grossCents: 10_000,
    refundedCents: 0,
    disputeStatus: "none",
    needsApproval: false,
  }

  it("starts pending for an untouched charge", () => {
    expect(initialPayoutState(base)).toEqual({
      status: "pending",
      reversedCents: 0,
      holdReasons: [],
      heldFromStatus: null,
    })
  })

  it("carries a refund that landed before the payout row", () => {
    expect(initialPayoutState({ ...base, refundedCents: 5_000 })).toMatchObject(
      { status: "pending", reversedCents: 4_250 }
    )
  })

  it("is reversed when the charge was already fully refunded", () => {
    expect(
      initialPayoutState({ ...base, refundedCents: 10_000 })
    ).toMatchObject({ status: "reversed", reversedCents: 8_500 })
  })

  it("holds for a dispute opened before the payout row", () => {
    expect(
      initialPayoutState({
        ...base,
        disputeStatus: "open",
        needsApproval: true,
      })
    ).toEqual({
      status: "held",
      reversedCents: 0,
      holdReasons: ["dispute"],
      heldFromStatus: "approval_required",
    })
  })
})

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

describe("cancellation policy refunds before the transfer", () => {
  // €60 booking, expert share €51 after the platform fee.
  const gross = 6000
  const expertShare = 5100

  it("a 50% refund on a scheduled payout halves what gets transferred", () => {
    const reversed = cumulativeReversalCents({
      refundedToDate: 3000,
      grossCents: gross,
      transferredCents: expertShare,
      reversedToDate: 0,
    })
    expect(reversed).toBe(2550)
    expect(expertShare - reversed).toBe(2550)
  })

  it("a payout created after the 50% refund starts already reduced", () => {
    const initial = initialPayoutState({
      amountCents: expertShare,
      grossCents: gross,
      refundedCents: 3000,
      disputeStatus: "none",
      needsApproval: false,
    })
    expect(initial.reversedCents).toBe(2550)
    expect(initial.status).toBe("pending")
  })

  it("a 0% cancellation leaves the full share to transfer", () => {
    expect(
      cumulativeReversalCents({
        refundedToDate: 0,
        grossCents: gross,
        transferredCents: expertShare,
        reversedToDate: 0,
      })
    ).toBe(0)
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

describe("nextPayoutStatusAfterRefund", () => {
  it("marks reversed for a full refund before transfer", () => {
    expect(
      nextPayoutStatusAfterRefund({
        previousStatus: "pending",
        amountCents: 8500,
        reversedCentsAfter: 8500,
        transferExists: false,
        reversalOk: true,
      })
    ).toBe("reversed")
  })

  it("keeps the prior status for a partial refund after a successful reversal", () => {
    expect(
      nextPayoutStatusAfterRefund({
        previousStatus: "transferred",
        amountCents: 8500,
        reversedCentsAfter: 2833,
        transferExists: true,
        reversalOk: true,
      })
    ).toBe("transferred")
  })

  it("parks reversal_pending when the refund succeeded but the reversal failed", () => {
    expect(
      nextPayoutStatusAfterRefund({
        previousStatus: "transferred",
        amountCents: 8500,
        reversedCentsAfter: 0,
        transferExists: true,
        reversalOk: false,
      })
    ).toBe("reversal_pending")
  })

  it("marks reversed on a lost dispute after the transfer is fully reversed", () => {
    expect(
      nextPayoutStatusAfterRefund({
        previousStatus: "held",
        amountCents: 8500,
        reversedCentsAfter: 8500,
        transferExists: true,
        reversalOk: true,
      })
    ).toBe("reversed")
  })
})

describe("nextPayoutStatusAfterTransferReversed", () => {
  it("restores held when a dispute hold is still open after a partial reversal", () => {
    expect(
      nextPayoutStatusAfterTransferReversed({
        full: false,
        status: "reversal_pending",
        holdReasons: ["dispute"],
        heldFromStatus: "transferred",
      })
    ).toBe("held")
  })

  it("restores transferred after a partial reversal with no remaining holds", () => {
    expect(
      nextPayoutStatusAfterTransferReversed({
        full: false,
        status: "reversal_pending",
        holdReasons: [],
        heldFromStatus: "transferred",
      })
    ).toBe("transferred")
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

describe("isInFlightIdempotencyConflict", () => {
  it("matches a concurrent request holding the same key", () => {
    expect(
      isInFlightIdempotencyConflict({ code: "idempotency_key_in_use" })
    ).toBe(true)
    expect(isInFlightIdempotencyConflict({ statusCode: 409 })).toBe(true)
  })

  it("does not match a parameter mismatch or other errors", () => {
    expect(
      isInFlightIdempotencyConflict({
        type: "StripeIdempotencyError",
        statusCode: 400,
      })
    ).toBe(false)
    expect(isInFlightIdempotencyConflict(new Error("boom"))).toBe(false)
  })
})
