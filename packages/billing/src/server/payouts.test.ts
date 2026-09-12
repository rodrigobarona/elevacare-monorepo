import { beforeEach, describe, expect, it, vi } from "vitest"

const transferCreate = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    transfers: { create: (...args: unknown[]) => transferCreate(...args) },
  }),
}))

vi.mock("@eleva/observability", () => ({
  captureException: vi.fn(),
}))

const payoutStates = { id: "id", bookingPaymentId: "bookingPaymentId" }
const bookingPayments = { id: "id" }

const scheduledPayout = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  bookingPaymentId: "33333333-3333-4333-8333-333333333333",
  status: "scheduled" as const,
  amountCents: 8500,
  reversedCents: 0,
  eligibleAt: new Date("2020-01-01T00:00:00.000Z"),
  destinationConnectAccountId: "acct_test",
  transferIdempotencyKey: "44444444-4444-4444-8444-444444444444",
  stripeTransferId: null,
  attempts: 0,
}

const paidPayment = {
  id: scheduledPayout.bookingPaymentId,
  bookingId: "55555555-5555-4333-8333-555555555555",
  stripeChargeId: "ch_test",
}

let persistAttempts = 0
let persistFailOnce = false

vi.mock("@eleva/db", () => {
  let currentTable: unknown
  const tx = {
    select: () => tx,
    from: (table: unknown) => {
      currentTable = table
      return tx
    },
    where: () => tx,
    limit: () =>
      currentTable === payoutStates ? [scheduledPayout] : [paidPayment],
    update: () => tx,
    set: () => tx,
    returning: () => [scheduledPayout],
    insert: () => tx,
    values: () => tx,
  }
  return {
    main: { payoutStates, bookingPayments, workflowDeadLetters: {} },
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
      throw new Error("lost response")
    }
    const tx = {
      update: () => tx,
      set: () => tx,
      where: () => tx,
      insert: () => tx,
      values: () => tx,
    }
    return fn(tx, { emit: async () => undefined })
  },
}))

const { executeTransfer } = await import("./payouts")

describe("executeTransfer idempotency", () => {
  beforeEach(() => {
    persistAttempts = 0
    persistFailOnce = false
    transferCreate.mockReset()
    const created = new Map<string, { id: string }>()
    transferCreate.mockImplementation(
      async (
        _params: unknown,
        opts: { idempotencyKey: string }
      ): Promise<{ id: string }> => {
        const existing = created.get(opts.idempotencyKey)
        if (existing) return existing
        const row = { id: "tr_once" }
        created.set(opts.idempotencyKey, row)
        return row
      }
    )
  })

  it("reuses the stored key so a lost response cannot mint a second transfer", async () => {
    persistFailOnce = true
    await expect(executeTransfer(scheduledPayout.id)).rejects.toThrow(
      "lost response"
    )
    const retry = await executeTransfer(scheduledPayout.id)
    expect(retry).toEqual({
      status: "transferred",
      stripeTransferId: "tr_once",
    })
    expect(transferCreate).toHaveBeenCalledTimes(2)
    expect(transferCreate.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: scheduledPayout.transferIdempotencyKey,
    })
    expect(transferCreate.mock.calls[1]?.[1]).toEqual({
      idempotencyKey: scheduledPayout.transferIdempotencyKey,
    })
  })
})
