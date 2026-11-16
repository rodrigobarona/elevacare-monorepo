import { describe, expect, it } from "vitest"
import { practiceClosureBlockers } from "./practice-closure"

describe("practiceClosureBlockers", () => {
  it("lists only what is still open, in a stable order", () => {
    expect(
      practiceClosureBlockers({
        UNPAID_SUBSCRIPTION: 1,
        FUTURE_BOOKINGS: 3,
        PENDING_REFUNDS: 0,
        OPEN_DISPUTES: 0,
        UNSETTLED_PAYOUTS: 2,
      })
    ).toEqual([
      { code: "FUTURE_BOOKINGS", count: 3 },
      { code: "UNSETTLED_PAYOUTS", count: 2 },
      { code: "UNPAID_SUBSCRIPTION", count: 1 },
    ])
  })

  it("is empty when nothing blocks the closure", () => {
    expect(
      practiceClosureBlockers({
        FUTURE_BOOKINGS: 0,
        PENDING_REFUNDS: 0,
        OPEN_DISPUTES: 0,
        UNSETTLED_PAYOUTS: 0,
        UNPAID_SUBSCRIPTION: 0,
      })
    ).toEqual([])
  })
})
