import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ExpertInvoiceStatus } from "./invoice-ops"
import {
  canMarkInvoiceManual,
  canRetryInvoice,
  markManualConflictCode,
  retryConflictCode,
  toPublicExpertInvoice,
} from "./invoice-ops"

const STATUSES: ExpertInvoiceStatus[] = [
  "pending",
  "issued",
  "failed",
  "manual_pending",
  "manual_issued",
]

describe("canRetryInvoice", () => {
  it.each(STATUSES)("is exhaustive for %s", (status) => {
    expect(typeof canRetryInvoice(status)).toBe("boolean")
  })

  it("allows only failed rows", () => {
    expect(STATUSES.filter(canRetryInvoice)).toEqual(["failed"])
  })
})

describe("canMarkInvoiceManual", () => {
  it("allows failed and manual_pending", () => {
    expect(STATUSES.filter(canMarkInvoiceManual)).toEqual([
      "failed",
      "manual_pending",
    ])
  })
})

describe("retryConflictCode", () => {
  it("maps issued states to already_issued", () => {
    expect(retryConflictCode("issued")).toBe("already_issued")
    expect(retryConflictCode("manual_issued")).toBe("already_issued")
  })

  it("maps manual_pending to not_retryable", () => {
    expect(retryConflictCode("manual_pending")).toBe("not_retryable")
  })
})

describe("markManualConflictCode", () => {
  it("distinguishes already-manual from auto-issued", () => {
    expect(markManualConflictCode("manual_issued")).toBe("already_manual")
    expect(markManualConflictCode("issued")).toBe("already_issued")
  })
})

describe("toPublicExpertInvoice", () => {
  it("serializes issuedAt and never includes member NIF", () => {
    const publicInvoice = toPublicExpertInvoice({
      id: "00000000-0000-4000-8000-000000000001",
      bookingId: "00000000-0000-4000-8000-000000000010",
      adapter: "toconline",
      status: "failed",
      amountCents: 6000,
      number: null,
      issuedAt: new Date("2026-09-15T10:00:00.000Z"),
      error: "toconline_v1_auto_finalize_blocked",
      attempts: 1,
      pdfUrl: null,
    })
    expect(publicInvoice.issuedAt).toBe("2026-09-15T10:00:00.000Z")
    expect(publicInvoice).not.toHaveProperty("memberNif")
    expect(publicInvoice.error).toBe("toconline_v1_auto_finalize_blocked")
  })
})

describe("retryExpertInvoice flag gate", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock("@eleva/flags", () => ({
      getFlag: vi.fn().mockResolvedValue(false),
    }))
    vi.doMock("@eleva/db", () => ({
      main: {
        expertInvoices: {},
        bookingPayments: {},
      },
      withOrgContext: vi.fn(),
    }))
    vi.doMock("@eleva/audit", () => ({
      withAudit: vi.fn(),
    }))
    vi.doMock("./dispatch", () => ({
      issueExpertServiceInvoice: vi.fn(),
    }))
  })

  it("refuses retry when expert invoicing apps are disabled", async () => {
    const { retryExpertInvoice } = await import("./invoice-ops")
    await expect(
      retryExpertInvoice({
        bookingId: "00000000-0000-4000-8000-000000000010",
        orgId: "00000000-0000-4000-8000-000000000002",
        actorUserId: "00000000-0000-4000-8000-000000000003",
      })
    ).rejects.toMatchObject({
      name: "ExpertInvoiceOpError",
      code: "flag_disabled",
      status: 403,
    })
  })
})
