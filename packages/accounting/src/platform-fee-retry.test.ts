import { beforeEach, describe, expect, it, vi } from "vitest"

const { state, getFlag, issuePlatformFeeInvoice } = vi.hoisted(() => ({
  state: {
    row: null as null | Record<string, unknown>,
    transitions: [] as Array<{ to: unknown; claimed: boolean }>,
    claim: true,
    failRestore: false,
  },
  getFlag: vi.fn(async () => true),
  issuePlatformFeeInvoice: vi.fn(),
}))

vi.mock("@eleva/flags", () => ({ getFlag }))
vi.mock("./platform-fee-issue", () => ({ issuePlatformFeeInvoice }))
vi.mock("@eleva/db", () => ({
  main: {
    platformFeeInvoices: {
      id: "id",
      orgId: "org_id",
      bookingPaymentId: "booking_payment_id",
      status: "status",
      error: "error",
    },
  },
  withPlatformAdminContext: async (fn: (tx: unknown) => unknown) =>
    fn({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => (state.row ? [state.row] : []),
          }),
        }),
      }),
    }),
}))
vi.mock("@eleva/audit", () => ({
  withPlatformAudit: async (
    _opts: unknown,
    fn: (tx: unknown, ctx: unknown) => unknown
  ) => {
    let to: unknown
    return fn(
      {
        update: () => ({
          set: (values: { status: unknown }) => {
            to = values.status
            return {
              where: () => ({
                returning: async () => {
                  if (state.failRestore && to !== "pending") {
                    throw new Error("restore failed")
                  }
                  state.transitions.push({ to, claimed: state.claim })
                  return state.claim ? [{ id: "fee-1" }] : []
                },
              }),
            }
          },
        }),
      },
      { emit: async () => undefined }
    )
  },
}))

import {
  canRetryPlatformFeeInvoice,
  retryPlatformFeeInvoice,
} from "./platform-fee-retry"

const INPUT = { invoiceId: "fee-1", actorUserId: "staff-1" }

function row(status: string) {
  return {
    id: "fee-1",
    orgId: "org-1",
    bookingPaymentId: "pay-1",
    status,
    error: "toconline_v1_auto_finalize_blocked",
  }
}

describe("retryPlatformFeeInvoice", () => {
  beforeEach(() => {
    state.row = null
    state.transitions = []
    state.claim = true
    state.failRestore = false
    getFlag.mockResolvedValue(true)
    issuePlatformFeeInvoice.mockReset()
  })

  it("treats issued, credited and D-09 rows as final", () => {
    for (const status of [
      "issued",
      "credited",
      "legacy",
      "legacy_missing",
    ] as const) {
      expect(canRetryPlatformFeeInvoice(status)).toBe(false)
    }
    expect(canRetryPlatformFeeInvoice("blocked")).toBe(true)
  })

  it("refuses when invoicing is disabled", async () => {
    getFlag.mockResolvedValue(false)
    await expect(retryPlatformFeeInvoice(INPUT)).rejects.toMatchObject({
      code: "flag_disabled",
      status: 403,
    })
  })

  it("returns not_found and not_retryable", async () => {
    await expect(retryPlatformFeeInvoice(INPUT)).rejects.toMatchObject({
      code: "not_found",
    })
    state.row = row("issued")
    await expect(retryPlatformFeeInvoice(INPUT)).rejects.toMatchObject({
      code: "not_retryable",
      status: 409,
    })
    expect(issuePlatformFeeInvoice).not.toHaveBeenCalled()
  })

  it("resets a blocked row to pending and re-runs classification", async () => {
    state.row = row("blocked")
    const result = {
      invoice: { id: "fee-1" },
      outcome: "blocked",
      reason: "toconline_v1_auto_finalize_blocked",
      domainEvent: null,
    }
    issuePlatformFeeInvoice.mockResolvedValue(result)

    await expect(retryPlatformFeeInvoice(INPUT)).resolves.toBe(result)
    expect(state.transitions).toEqual([{ to: "pending", claimed: true }])
    expect(issuePlatformFeeInvoice).toHaveBeenCalledWith({
      bookingPaymentId: "pay-1",
    })
  })

  it("restores the prior status when the re-run records nothing", async () => {
    state.row = row("skipped")
    issuePlatformFeeInvoice.mockResolvedValue({
      invoice: null,
      outcome: "skipped",
      reason: "payment_not_succeeded",
      domainEvent: null,
    })

    await retryPlatformFeeInvoice(INPUT)
    expect(state.transitions.map((t) => t.to)).toEqual(["pending", "skipped"])
  })

  it("leaves an already-recorded row as the concurrent run left it", async () => {
    state.row = row("failed")
    const result = {
      invoice: { id: "fee-1" },
      outcome: "already_recorded",
      reason: null,
      domainEvent: null,
    }
    issuePlatformFeeInvoice.mockResolvedValue(result)

    await expect(retryPlatformFeeInvoice(INPUT)).resolves.toBe(result)
    expect(state.transitions.map((t) => t.to)).toEqual(["pending"])
  })

  it("rethrows the issuance error even when the restore also fails", async () => {
    state.row = row("failed")
    issuePlatformFeeInvoice.mockRejectedValue(new Error("db down"))
    state.failRestore = true
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    await expect(retryPlatformFeeInvoice(INPUT)).rejects.toThrow("db down")
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("reports a conflict when the row changed before the claim", async () => {
    state.row = row("failed")
    state.claim = false
    await expect(retryPlatformFeeInvoice(INPUT)).rejects.toMatchObject({
      code: "conflict",
    })
    expect(issuePlatformFeeInvoice).not.toHaveBeenCalled()
  })
})
