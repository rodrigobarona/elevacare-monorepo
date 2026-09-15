import { describe, expect, it } from "vitest"
import { AdapterError } from "../../types"
import {
  TOC_EXTRA_COUNTRY_CODES,
  TOC_V1_DOCUMENT_TYPES,
  TOC_V1_ITEM_TYPES,
  TOC_V1_RETIFICATIVE_TYPES,
  mapIssueInvoiceToV1Payload,
} from "./payload"

const baseInput = {
  bookingId: "00000000-0000-4000-8000-000000000010",
  expertProfileId: "00000000-0000-4000-8000-000000000001",
  member: {
    fiscalId: "999999990",
    name: "Member",
    country: "PT",
    address: "Rua Example 1",
  },
  lines: [
    {
      description: "Session",
      quantity: 1,
      unitPrice: 50,
      taxRate: 23,
      currency: "EUR",
    },
  ],
  date: "2026-09-15",
  notes: "Booking note",
}

describe("mapIssueInvoiceToV1Payload", () => {
  it("emits v1 field names and omits finalize", () => {
    const payload = mapIssueInvoiceToV1Payload(baseInput)
    expect(payload.document_type).toBe("FT")
    expect(payload.customer_business_name).toBe("Member")
    expect(payload.customer_tax_registration_number).toBe("999999990")
    expect(payload.customer_country).toBe("PT")
    expect(payload.customer_address_detail).toBe("Rua Example 1")
    expect(payload.payment_mechanism).toBe("MO")
    expect(payload.vat_included_prices).toBe(false)
    expect(payload.currency_iso_code).toBe("EUR")
    expect(payload.external_reference).toBe(baseInput.bookingId)
    expect(payload.lines[0]).toMatchObject({
      item_type: "Service",
      description: "Session",
      quantity: 1,
      unit_price: 50,
      tax_code: "NOR",
      tax_percentage: 23,
    })
    expect(payload).not.toHaveProperty("finalize")
    expect(payload.tax_exemption_reason_id).toBeUndefined()
  })

  it("maps reverse-charge as ISE 0% without inventing exemption id 7", () => {
    const payload = mapIssueInvoiceToV1Payload({
      ...baseInput,
      member: { ...baseInput.member, fiscalId: "ESB12345678", country: "ES" },
      lines: [
        {
          description: "Session",
          quantity: 1,
          unitPrice: 50,
          taxRate: 0,
          taxTreatment: "reverse_charge",
          currency: "EUR",
        },
      ],
    })
    expect(payload.lines[0]?.tax_code).toBe("ISE")
    expect(payload.lines[0]?.tax_percentage).toBe(0)
    expect(payload.tax_exemption_reason_id).toBeUndefined()
  })

  it("attaches a looked-up exemption reason id when provided", () => {
    const payload = mapIssueInvoiceToV1Payload(
      {
        ...baseInput,
        lines: [
          {
            description: "Session",
            quantity: 1,
            unitPrice: 50,
            taxRate: 0,
            taxTreatment: "zero_rated",
            currency: "EUR",
          },
        ],
      },
      { taxExemptionReasonId: "99" }
    )
    expect(payload.tax_exemption_reason_id).toBe("99")
  })

  it("refuses mixed currencies", () => {
    expect(() =>
      mapIssueInvoiceToV1Payload({
        ...baseInput,
        lines: [
          { ...baseInput.lines[0]!, currency: "EUR" },
          {
            description: "Travel",
            quantity: 1,
            unitPrice: 10,
            taxRate: 23,
            currency: "USD",
          },
        ],
      })
    ).toThrow(AdapterError)
  })

  it("refuses a 0% line with the default standard treatment", () => {
    expect(() =>
      mapIssueInvoiceToV1Payload({
        ...baseInput,
        lines: [
          {
            description: "Session",
            quantity: 1,
            unitPrice: 50,
            taxRate: 0,
            currency: "EUR",
          },
        ],
      })
    ).toThrow(AdapterError)
  })

  it("refuses exempt until the accountant signs a legal code", () => {
    expect(() =>
      mapIssueInvoiceToV1Payload({
        ...baseInput,
        lines: [
          {
            description: "Session",
            quantity: 1,
            unitPrice: 50,
            taxRate: 0,
            taxTreatment: "exempt",
            currency: "EUR",
          },
        ],
      })
    ).toThrow(/exemption code/)
  })

  it("refuses mixed standard and reverse-charge on one document", () => {
    expect(() =>
      mapIssueInvoiceToV1Payload({
        ...baseInput,
        lines: [
          {
            description: "A",
            quantity: 1,
            unitPrice: 10,
            taxRate: 23,
            taxTreatment: "standard",
            currency: "EUR",
          },
          {
            description: "B",
            quantity: 1,
            unitPrice: 10,
            taxRate: 0,
            taxTreatment: "reverse_charge",
            currency: "EUR",
          },
        ],
      })
    ).toThrow(/IVA treatments/)
  })

  it("refuses mixed exemption treatments on one document", () => {
    expect(() =>
      mapIssueInvoiceToV1Payload({
        ...baseInput,
        lines: [
          {
            description: "A",
            quantity: 1,
            unitPrice: 10,
            taxRate: 0,
            taxTreatment: "reverse_charge",
            currency: "EUR",
          },
          {
            description: "B",
            quantity: 1,
            unitPrice: 10,
            taxRate: 0,
            taxTreatment: "zero_rated",
            currency: "EUR",
          },
        ],
      })
    ).toThrow(/IVA treatments/)
  })

  it("documents v1 vs retificative types and extra countries from the full doc", () => {
    expect(TOC_V1_DOCUMENT_TYPES).toEqual(["FT", "FS", "FR"])
    expect(TOC_V1_RETIFICATIVE_TYPES).toEqual(["NC", "ND"])
    expect(TOC_V1_ITEM_TYPES).toEqual(["Service", "Product", "TaxDescriptor"])
    expect(TOC_EXTRA_COUNTRY_CODES).toEqual(["PT-AC", "PT-MA"])
  })
})
