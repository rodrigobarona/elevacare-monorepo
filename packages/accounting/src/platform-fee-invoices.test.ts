import { describe, expect, it } from "vitest"
import { SaftExportError } from "./saft-export"
import {
  listPlatformFeeInvoices,
  toPublicPlatformFeeInvoice,
} from "./platform-fee-invoices"

describe("toPublicPlatformFeeInvoice", () => {
  it("serializes issuedAt and keeps conservative IVA/AT codes", () => {
    const publicInvoice = toPublicPlatformFeeInvoice({
      id: "00000000-0000-4000-8000-000000000001",
      bookingPaymentId: "00000000-0000-4000-8000-000000000010",
      expertOrgId: "00000000-0000-4000-8000-000000000020",
      status: "pending",
      ivaRegime: "eu_unclassified",
      amountCents: 1500,
      ivaRateBps: 0,
      series: null,
      number: null,
      atStatus: "operator_gated",
      issuedAt: new Date("2026-09-17T10:00:00.000Z"),
      error: "toconline_v1_auto_finalize_blocked",
      attempts: 0,
    })
    expect(publicInvoice.issuedAt).toBe("2026-09-17T10:00:00.000Z")
    expect(publicInvoice.ivaRegime).toBe("eu_unclassified")
    expect(publicInvoice.atStatus).toBe("operator_gated")
    expect(publicInvoice).not.toHaveProperty("toconlineDocumentId")
  })
})

describe("listPlatformFeeInvoices", () => {
  it("rejects invalid months before querying", async () => {
    await expect(
      listPlatformFeeInvoices({ month: "2026-13" })
    ).rejects.toBeInstanceOf(SaftExportError)
  })
})
