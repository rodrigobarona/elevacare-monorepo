import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdapterError } from "./types"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"
import {
  buildMemberInvoiceInput,
  invoiceStatusFromAdapterError,
  isUniqueViolation,
} from "./dispatch"

describe("buildMemberInvoiceInput", () => {
  it("uses exempt tax treatment until accountant rates are signed", () => {
    const input = buildMemberInvoiceInput({
      bookingId: "00000000-0000-4000-8000-000000000010",
      expertProfileId: "00000000-0000-4000-8000-000000000001",
      buyerTaxId: "999999990",
      guestName: "Ana",
      guestEmail: "ana@example.com",
      memberCountry: "PT",
      amountCents: 6000,
      currency: "EUR",
      paidAt: new Date("2026-09-15T10:00:00.000Z"),
    })
    expect(input.date).toBe("2026-09-15")
    expect(input.member.fiscalId).toBe("999999990")
    expect(input.lines[0]).toMatchObject({
      unitPrice: 60,
      taxRate: 0,
      taxTreatment: "exempt",
      currency: "EUR",
    })
  })
})

describe("isUniqueViolation", () => {
  it("detects nested postgres 23505 errors", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isUniqueViolation(new Error("plain"))).toBe(false)
  })
})

describe("invoiceStatusFromAdapterError", () => {
  it("keeps the v1 auto-finalize block code for dispatch", () => {
    const err = new AdapterError(
      "fatal",
      "blocked",
      TOC_V1_AUTO_FINALIZE_BLOCKED
    )
    expect(invoiceStatusFromAdapterError(err)).toEqual({
      status: "failed",
      error: TOC_V1_AUTO_FINALIZE_BLOCKED,
    })
  })
})

describe("issueExpertServiceInvoice flag gate", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock("@eleva/flags", () => ({
      getFlag: vi.fn().mockResolvedValue(false),
    }))
    vi.doMock("@eleva/db", () => ({
      main: {},
      withOrgContext: vi.fn(),
    }))
    vi.doMock("@eleva/audit", () => ({
      withAudit: vi.fn(),
    }))
  })

  it("skips when expert invoicing apps are disabled", async () => {
    const { issueExpertServiceInvoice } = await import("./dispatch")
    await expect(
      issueExpertServiceInvoice({
        bookingPaymentId: "00000000-0000-4000-8000-000000000099",
        orgId: "00000000-0000-4000-8000-000000000002",
      })
    ).resolves.toEqual({ skipped: true, reason: "flag_disabled" })
  })
})
