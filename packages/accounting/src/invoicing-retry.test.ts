import { beforeEach, describe, expect, it, vi } from "vitest"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"
import {
  classifyFailedInvoiceForRetry,
  classifyRetryResult,
} from "./invoicing-retry"

describe("classifyFailedInvoiceForRetry", () => {
  const now = new Date("2026-09-17T12:00:00.000Z")

  it("dead-letters rows at the slow-stage cap", () => {
    expect(
      classifyFailedInvoiceForRetry({
        attempts: 10,
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        now,
      })
    ).toBe("dead_letter")
  })

  it("skips recently updated failed rows", () => {
    expect(
      classifyFailedInvoiceForRetry({
        attempts: 1,
        updatedAt: new Date("2026-09-17T11:45:00.000Z"),
        now,
      })
    ).toBe("too_recent")
  })

  it("retries aged failed rows under the cap", () => {
    expect(
      classifyFailedInvoiceForRetry({
        attempts: 1,
        updatedAt: new Date("2026-09-17T11:00:00.000Z"),
        now,
      })
    ).toBe("retry")
  })
})

describe("classifyRetryResult", () => {
  it("records the closed issuance gate as blocked, not issued", () => {
    expect(
      classifyRetryResult({
        status: "failed",
        error: TOC_V1_AUTO_FINALIZE_BLOCKED,
      })
    ).toBe("blocked")
  })

  it("counts a failed retry without the gate code as retried", () => {
    expect(
      classifyRetryResult({
        status: "failed",
        error: "credentials",
      })
    ).toBe("retried")
  })
})

describe("retryFailedExpertInvoices", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("retries aged failures, skips recent ones, and dead-letters the cap", async () => {
    const retry = vi.fn().mockResolvedValue({
      id: "inv-retry",
      bookingId: "book-retry",
      adapter: "toconline",
      status: "failed",
      amountCents: 6000,
      number: null,
      issuedAt: null,
      error: TOC_V1_AUTO_FINALIZE_BLOCKED,
      attempts: 2,
      pdfUrl: null,
    })
    const emit = vi.fn()
    const insertReturning = vi.fn().mockResolvedValue([{ id: "dlq-1" }])
    const now = new Date("2026-09-17T12:00:00.000Z")

    vi.doMock("@eleva/db", () => ({
      main: {
        expertInvoices: {
          id: "id",
          bookingId: "bookingId",
          orgId: "orgId",
          attempts: "attempts",
          updatedAt: "updatedAt",
          error: "error",
          status: "status",
        },
        workflowDeadLetters: {
          id: "dlqId",
          workflowName: "workflowName",
          entityId: "entityId",
          status: "status",
        },
      },
      withPlatformAdminContext: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({
              leftJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: async () => [
                      {
                        id: "inv-recent",
                        bookingId: "book-recent",
                        orgId: "org-1",
                        attempts: 1,
                        updatedAt: new Date("2026-09-17T11:50:00.000Z"),
                        error: TOC_V1_AUTO_FINALIZE_BLOCKED,
                      },
                      {
                        id: "inv-retry",
                        bookingId: "book-retry",
                        orgId: "org-1",
                        attempts: 1,
                        updatedAt: new Date("2026-09-17T11:00:00.000Z"),
                        error: TOC_V1_AUTO_FINALIZE_BLOCKED,
                      },
                      {
                        id: "inv-dlq",
                        bookingId: "book-dlq",
                        orgId: "org-1",
                        attempts: 10,
                        updatedAt: new Date("2026-09-16T00:00:00.000Z"),
                        error: TOC_V1_AUTO_FINALIZE_BLOCKED,
                      },
                    ],
                  }),
                }),
              }),
            }),
          }),
        })
      ),
    }))
    vi.doMock("@eleva/audit", () => ({
      withPlatformAudit: vi.fn(
        async (
          _opts: unknown,
          fn: (
            tx: unknown,
            ctx: { emit: (row: unknown) => Promise<void> }
          ) => unknown
        ) =>
          fn(
            {
              select: () => ({
                from: () => ({
                  where: () => ({
                    limit: () => ({
                      for: async () => [
                        {
                          status: "failed",
                          attempts: 10,
                          error: TOC_V1_AUTO_FINALIZE_BLOCKED,
                        },
                      ],
                    }),
                  }),
                }),
              }),
              insert: () => ({
                values: () => ({
                  onConflictDoNothing: () => ({
                    returning: insertReturning,
                  }),
                }),
              }),
            },
            { emit }
          )
      ),
    }))
    vi.doMock("./invoice-ops", () => ({
      isExpertInvoiceOpError: () => false,
      retryExpertInvoice: retry,
    }))

    const { retryFailedExpertInvoices } = await import("./invoicing-retry")
    const result = await retryFailedExpertInvoices({ now })

    expect(result).toEqual({
      scanned: 3,
      retried: 0,
      skipped: 1,
      blocked: 1,
      deadLettered: 1,
      errors: 0,
    })
    expect(retry).toHaveBeenCalledTimes(1)
    expect(retry).toHaveBeenCalledWith({
      bookingId: "book-retry",
      orgId: "org-1",
      actorUserId: null,
    })
    expect(insertReturning).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledTimes(1)
  })
})
