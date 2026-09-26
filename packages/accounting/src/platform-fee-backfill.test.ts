import { beforeEach, describe, expect, it, vi } from "vitest"

const column = (name: string) =>
  new Proxy({}, { get: (_t, key) => `${name}.${String(key)}` })

function mockDeps(input: {
  flag?: boolean
  candidates: { id: string; orgId: string }[]
  issue: ReturnType<typeof vi.fn>
  deadLetterFails?: boolean
}) {
  const emit = vi.fn()
  const insertValues = vi.fn()
  const limit = vi.fn(async () => input.candidates)
  const subquery = { from: () => ({ where: () => ({}) }) }
  vi.doMock("@eleva/flags", () => ({
    getFlag: vi.fn(async () => input.flag ?? true),
  }))
  vi.doMock("@eleva/db", () => ({
    main: {
      bookingPayments: column("bp"),
      platformFeeInvoices: column("pfi"),
      workflowDeadLetters: column("dlq"),
    },
    withPlatformAdminContext: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        select: (fields: Record<string, unknown>) =>
          "orgId" in fields
            ? {
                from: () => ({ where: () => ({ orderBy: () => ({ limit }) }) }),
              }
            : subquery,
      })
    ),
  }))
  vi.doMock("@eleva/audit", () => ({
    withPlatformAudit: vi.fn(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        if (input.deadLetterFails) throw new Error("db down")
        return fn(
          {
            insert: () => ({
              values: (row: unknown) => {
                insertValues(row)
                return {
                  onConflictDoNothing: () => ({
                    returning: async () => [{ id: "dlq-1" }],
                  }),
                }
              },
            }),
          },
          { emit }
        )
      }
    ),
  }))
  vi.doMock("./platform-fee-issue", () => ({
    issuePlatformFeeInvoice: input.issue,
  }))
  return { emit, insertValues, limit }
}

const recorded = (outcome: string) => ({
  invoice: { id: `inv-${outcome}` },
  outcome,
  reason: null,
  domainEvent: null,
})

describe("backfillMissingPlatformFeeInvoices", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("does nothing while invoicing is disabled", async () => {
    const issue = vi.fn()
    const { limit } = mockDeps({ flag: false, candidates: [], issue })
    const { backfillMissingPlatformFeeInvoices } =
      await import("./platform-fee-backfill")

    const result = await backfillMissingPlatformFeeInvoices()

    expect(result.scanned).toBe(0)
    expect(limit).not.toHaveBeenCalled()
    expect(issue).not.toHaveBeenCalled()
  })

  it("records a ledger row for each payment missing one", async () => {
    const issue = vi
      .fn()
      .mockResolvedValueOnce(recorded("blocked"))
      .mockResolvedValueOnce(recorded("skipped"))
    const { emit } = mockDeps({
      candidates: [
        { id: "pay-1", orgId: "org-1" },
        { id: "pay-2", orgId: "org-1" },
      ],
      issue,
    })
    const { backfillMissingPlatformFeeInvoices } =
      await import("./platform-fee-backfill")

    const result = await backfillMissingPlatformFeeInvoices()

    expect(issue).toHaveBeenNthCalledWith(1, {
      bookingPaymentId: "pay-1",
      insertOnly: true,
    })
    expect(issue).toHaveBeenNthCalledWith(2, {
      bookingPaymentId: "pay-2",
      insertOnly: true,
    })
    expect(result).toEqual({
      scanned: 2,
      recorded: { skipped: 1, blocked: 1, pending: 0, already_recorded: 0 },
      deadLettered: 0,
      errors: 0,
    })
    expect(emit).not.toHaveBeenCalled()
  })

  it("dead-letters payments that still have no row so they cannot fill the batch", async () => {
    const issue = vi
      .fn()
      .mockRejectedValueOnce(new Error("lookup exploded"))
      .mockResolvedValueOnce({
        invoice: null,
        outcome: "skipped",
        reason: "expert_profile_missing",
        domainEvent: null,
      })
    const { emit, insertValues } = mockDeps({
      candidates: [
        { id: "pay-err", orgId: "org-1" },
        { id: "pay-noprofile", orgId: "org-2" },
      ],
      issue,
    })
    const { backfillMissingPlatformFeeInvoices } =
      await import("./platform-fee-backfill")

    const result = await backfillMissingPlatformFeeInvoices()

    expect(result.errors).toBe(1)
    expect(result.deadLettered).toBe(2)
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowName: "platform-fee-backfill",
        entityId: "pay-noprofile",
        lastError: "expert_profile_missing",
      })
    )
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "booking_payment",
        action: "failed",
        entityId: "pay-err",
      })
    )
  })

  it("does not park payments when the flag flips off mid-run", async () => {
    const issue = vi.fn().mockResolvedValue({
      invoice: null,
      outcome: "skipped",
      reason: "flag_disabled",
      domainEvent: null,
    })
    const { insertValues } = mockDeps({
      candidates: [{ id: "pay-1", orgId: "org-1" }],
      issue,
    })
    const { backfillMissingPlatformFeeInvoices } =
      await import("./platform-fee-backfill")

    const result = await backfillMissingPlatformFeeInvoices()

    expect(result.deadLettered).toBe(0)
    expect(insertValues).not.toHaveBeenCalled()
  })

  it("counts a failed dead-letter write as an error", async () => {
    const issue = vi.fn().mockResolvedValue({
      invoice: null,
      outcome: "skipped",
      reason: "expert_profile_missing",
      domainEvent: null,
    })
    mockDeps({
      candidates: [{ id: "pay-1", orgId: "org-1" }],
      issue,
      deadLetterFails: true,
    })
    const { backfillMissingPlatformFeeInvoices } =
      await import("./platform-fee-backfill")

    const result = await backfillMissingPlatformFeeInvoices()

    expect(result.deadLettered).toBe(0)
    expect(result.errors).toBe(1)
  })
})
