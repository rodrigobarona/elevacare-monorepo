import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { classifyIvaRegime } from "./core/iva-matrix"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"
import {
  decidePlatformFeeRecord,
  elevaFeeSeries,
  isD09PlatformFeeStatus,
  isTerminalPlatformFeeStatus,
  issuePlatformFeeCreditNote,
  ivaRateBpsFromLookups,
  shouldIssuePlatformFeeCreditNote,
} from "./platform-fee-issue"

describe("shouldIssuePlatformFeeCreditNote", () => {
  it("originates a credit note only when commission is reduced", () => {
    expect(shouldIssuePlatformFeeCreditNote(0)).toBe(false)
    expect(shouldIssuePlatformFeeCreditNote(-1)).toBe(false)
    expect(shouldIssuePlatformFeeCreditNote(1500)).toBe(true)
  })
})

describe("D-09 and terminal statuses", () => {
  it("never reissues legacy rows", () => {
    expect(isD09PlatformFeeStatus("legacy")).toBe(true)
    expect(isD09PlatformFeeStatus("legacy_missing")).toBe(true)
    expect(isD09PlatformFeeStatus("blocked")).toBe(false)
    expect(isTerminalPlatformFeeStatus("pending")).toBe(false)
    expect(isTerminalPlatformFeeStatus("skipped")).toBe(true)
    expect(isTerminalPlatformFeeStatus("blocked")).toBe(true)
  })
})

describe("elevaFeeSeries", () => {
  it("uses the Lisbon calendar year without communicating the series", () => {
    expect(elevaFeeSeries(new Date("2026-01-01T00:30:00.000Z"))).toBe(
      "ELEVA-FEE-2026"
    )
  })
})

describe("decidePlatformFeeRecord", () => {
  it("skips extra-EU instead of indiscriminate zero-rate", () => {
    const decided = decidePlatformFeeRecord({
      iva: classifyIvaRegime({ countryIso: "US" }),
      lookups: null,
      amountCents: 1500,
    })
    expect(decided).toMatchObject({
      status: "skipped",
      error: "extra_eu_not_indiscriminate_zero_rate",
      ivaRegime: "extra_eu_unclassified",
    })
  })

  it("skips EU without valid VIES instead of auto-consumer", () => {
    const decided = decidePlatformFeeRecord({
      iva: classifyIvaRegime({ countryIso: "ES", viesStatus: "invalid" }),
      lookups: null,
      amountCents: 1500,
    })
    expect(decided).toMatchObject({
      status: "skipped",
      error: "eu_without_valid_vies_not_auto_consumer",
      ivaRegime: "eu_unclassified",
    })
  })

  it("skips when VIES is unavailable (fail-closed)", () => {
    const decided = decidePlatformFeeRecord({
      iva: classifyIvaRegime({ countryIso: "IT", viesStatus: "unavailable" }),
      lookups: null,
      amountCents: 1500,
    })
    expect(decided).toMatchObject({
      status: "skipped",
      error: "vies_unavailable_fail_closed",
      ivaRegime: "vies_unavailable",
    })
  })

  it("blocks PT territorial issuance at the v1 auto-finalize gate", () => {
    const decided = decidePlatformFeeRecord({
      iva: classifyIvaRegime({ countryIso: "PT" }),
      lookups: {
        ok: true,
        regime: "pt_territorial",
        tax: {
          id: "103",
          taxCode: "NOR",
          taxCountryRegion: "PT",
          taxPercentage: 23,
        },
      },
      amountCents: 1500,
    })
    expect(decided).toEqual({
      status: "blocked",
      error: TOC_V1_AUTO_FINALIZE_BLOCKED,
      ivaRegime: "pt_territorial",
      ivaRateBps: 2300,
    })
  })

  it("skips zero-fee bookings without treating them as issued", () => {
    expect(
      decidePlatformFeeRecord({
        iva: classifyIvaRegime({ countryIso: "PT" }),
        lookups: null,
        amountCents: 0,
      }).status
    ).toBe("skipped")
  })

  it("keeps GET lookup failures retryable instead of terminal skipped", () => {
    const missing = decidePlatformFeeRecord({
      iva: classifyIvaRegime({ countryIso: "PT" }),
      lookups: null,
      amountCents: 1500,
    })
    expect(missing).toMatchObject({
      status: "pending",
      error: "iva_lookup_unavailable",
      ivaRegime: "pt_territorial",
      ivaRateBps: 0,
    })
    expect(isTerminalPlatformFeeStatus("pending")).toBe(false)
  })

  it("skips unresolved GET lookups instead of posting", () => {
    const decided = decidePlatformFeeRecord({
      iva: classifyIvaRegime({ countryIso: "PT" }),
      lookups: {
        ok: false,
        regime: "pt_territorial",
        reason: "pt_territorial_tax_lookup_unresolved",
      },
      amountCents: 1500,
    })
    expect(decided.status).toBe("pending")
    expect(decided.error).toBe("pt_territorial_tax_lookup_unresolved")
    expect(isTerminalPlatformFeeStatus(decided.status)).toBe(false)
  })
})

describe("ivaRateBpsFromLookups", () => {
  it("converts GET tax percentage to basis points without inventing 23%", () => {
    expect(
      ivaRateBpsFromLookups({
        ok: true,
        regime: "pt_territorial",
        tax: {
          id: "1",
          taxCode: "NOR",
          taxCountryRegion: "PT",
          taxPercentage: 17.5,
        },
      })
    ).toBe(1750)
  })
})

describe("issuePlatformFeeInvoice flag gate", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock("@eleva/flags", () => ({
      getFlag: vi.fn().mockResolvedValue(false),
    }))
  })

  it("skips without writing when toconline invoicing is disabled", async () => {
    const { issuePlatformFeeInvoice } = await import("./platform-fee-issue")
    await expect(
      issuePlatformFeeInvoice({
        bookingPaymentId: "00000000-0000-4000-8000-000000000099",
      })
    ).resolves.toEqual({
      invoice: null,
      outcome: "skipped",
      reason: "flag_disabled",
    })
  })
})

describe("closed-gate source", () => {
  it("does not POST commercial sales documents", () => {
    const src = readFileSync(
      new URL("./platform-fee-issue.ts", import.meta.url),
      "utf8"
    )
    expect(src).not.toMatch(/fetch\s*\(/)
    expect(src).not.toMatch(/method:\s*["']POST["']/)
    expect(src).not.toMatch(/paidAt \?\? new Date/)
    expect(src).toContain("assertV1SalesDocumentPostAllowed")
    expect(src).toContain("payment_paid_at_missing")
    expect(src).toContain("iva_lookup_unavailable")
    expect(src).toContain("bookingRefundId")
    expect(src).toContain("platformFeeCreditNotes.bookingRefundId")
  })
})

describe("issuePlatformFeeCreditNote gate", () => {
  it("does not originate a credit note from a refund without commission reduction", async () => {
    await expect(
      issuePlatformFeeCreditNote({
        bookingPaymentId: "00000000-0000-4000-8000-000000000099",
        bookingRefundId: "00000000-0000-4000-8000-000000000088",
        commissionReductionCents: 0,
      })
    ).resolves.toEqual({ skipped: true, reason: "no_commission_reduction" })
  })
})
