import { beforeEach, describe, expect, it, vi } from "vitest"

const createReversal = vi.fn()
const listReversals = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    transfers: {
      createReversal: (...args: unknown[]) => createReversal(...args),
      listReversals: (...args: unknown[]) => listReversals(...args),
    },
  }),
}))

vi.mock("@eleva/observability", () => ({
  captureException: vi.fn(),
}))

const payout = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  bookingPaymentId: "33333333-3333-4333-8333-333333333333",
  status: "transferred" as const,
  amountCents: 8500,
  reversedCents: 0,
  stripeTransferId: "tr_test",
}

const refundId = "55555555-5555-4333-8333-555555555555"
const reversalRowId = "66666666-6666-4333-8333-666666666666"

let reversalRow: {
  id: string
  status: "pending" | "failed" | "succeeded"
  amountCents: number
  stripeReversalId: string | null
} | null = {
  id: reversalRowId,
  status: "failed",
  amountCents: 2500,
  stripeReversalId: null,
}

let persistFailOnce = false
let persistAttempts = 0
const stripeReversals: Array<{
  id: string
  metadata: { reversal_row_id?: string; refund_row_id?: string }
}> = []

vi.mock("@eleva/db", () => {
  const retryRows = [
    {
      refundId,
      reversalCents: 2500,
      payout,
    },
  ]
  const tx = {
    select: () => tx,
    from: () => tx,
    innerJoin: () => tx,
    where: () => tx,
    limit: () => (reversalRow ? [reversalRow] : []),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(retryRows).then(resolve, reject),
    update: () => tx,
    set: () => tx,
    returning: () => [
      {
        id: reversalRowId,
        reversedCents: 2500,
        amountCents: 8500,
        status: "transferred",
      },
    ],
    insert: () => tx,
    values: () => tx,
    onConflictDoNothing: () => tx,
  }
  return {
    main: {
      transferReversals: {
        refundId: "refundId",
        amountCents: "amountCents",
        payoutStateId: "payoutStateId",
        id: "id",
        status: "status",
      },
      payoutStates: { id: "id" },
      bookingRefunds: { id: "id", status: "status" },
    },
    withPlatformAdminContext: (fn: (handle: typeof tx) => unknown) => fn(tx),
    withOrgContext: (_org: string, fn: (handle: typeof tx) => unknown) =>
      fn(tx),
  }
})

vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _opts: unknown,
    fn: (tx: unknown, ctx: { emit: () => Promise<void> }) => Promise<unknown>
  ) => {
    persistAttempts += 1
    if (persistFailOnce && persistAttempts === 1) {
      throw new Error("lost persist")
    }
    const tx = {
      update: () => tx,
      set: () => tx,
      where: () => tx,
      returning: () => [
        { id: reversalRowId, reversedCents: 2500, amountCents: 8500 },
      ],
      insert: () => tx,
      values: () => tx,
      onConflictDoNothing: () => tx,
    }
    return fn(tx, { emit: async () => undefined })
  },
}))

vi.mock("./payouts", () => ({
  applyHold: vi.fn(),
  clearHold: vi.fn(),
}))

const { retryFailedTransferReversals } = await import("./refunds")

describe("retryFailedTransferReversals", () => {
  beforeEach(() => {
    persistAttempts = 0
    persistFailOnce = false
    stripeReversals.length = 0
    reversalRow = {
      id: reversalRowId,
      status: "failed",
      amountCents: 2500,
      stripeReversalId: null,
    }
    createReversal.mockReset()
    listReversals.mockReset()
    createReversal.mockImplementation(
      async (
        _transferId: string,
        params: {
          metadata: { reversal_row_id?: string; refund_row_id?: string }
        }
      ) => {
        const row = {
          id: `trr_${stripeReversals.length + 1}`,
          metadata: params.metadata,
        }
        stripeReversals.push(row)
        return row
      }
    )
    listReversals.mockImplementation(async () => ({
      data: [...stripeReversals],
      has_more: false,
    }))
  })

  it("reuses a Stripe reversal found by metadata instead of creating a second one", async () => {
    stripeReversals.push({
      id: "trr_existing",
      metadata: {
        reversal_row_id: reversalRowId,
        refund_row_id: refundId,
      },
    })
    await expect(retryFailedTransferReversals()).resolves.toEqual({
      retried: 1,
    })
    expect(createReversal).not.toHaveBeenCalled()
    expect(listReversals).toHaveBeenCalledWith("tr_test", { limit: 100 })
  })

  it("walks later listReversals pages before creating", async () => {
    listReversals
      .mockResolvedValueOnce({
        data: [
          {
            id: "trr_other",
            metadata: { refund_row_id: "other" },
          },
        ],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "trr_page_two",
            metadata: {
              reversal_row_id: reversalRowId,
              refund_row_id: refundId,
            },
          },
        ],
        has_more: false,
      })
    await expect(retryFailedTransferReversals()).resolves.toEqual({
      retried: 1,
    })
    expect(createReversal).not.toHaveBeenCalled()
    expect(listReversals).toHaveBeenNthCalledWith(2, "tr_test", {
      limit: 100,
      starting_after: "trr_other",
    })
  })

  it("does not create a second reversal after a lost persist once Stripe already reversed", async () => {
    persistFailOnce = true
    await expect(retryFailedTransferReversals()).resolves.toEqual({
      retried: 1,
    })
    persistFailOnce = false
    await expect(retryFailedTransferReversals()).resolves.toEqual({
      retried: 1,
    })
    expect(createReversal).toHaveBeenCalledTimes(1)
    expect(createReversal.mock.calls[0]?.[2]).toEqual({
      idempotencyKey: `reversal:${reversalRowId}`,
    })
  })
})
