import { AdapterError, IssueInvoiceInput } from "../../types"

/**
 * Map Eleva `IssueInvoiceInput` to a v1 commercial sales-document body.
 *
 * Field names follow https://api-docs.toconline.pt (Documentos de Venda).
 * (Documentos de Venda). Official SSOT: https://api-docs.toconline.pt
 *
 * v1 has no `finalize` field — submit auto-finalizes. Do not send drafts
 * on this path. `tax_exemption_reason_id` is document-level and must come
 * from `GET /tax_exemption_reasons?filter[code]=` — never hardcode 7/99
 * as production-signed (TEST scaffolding observed those ids on one company).
 */

export const TOC_V1_DOCUMENT_TYPES = ["FT", "FS", "FR"] as const
export const TOC_V1_RETIFICATIVE_TYPES = ["NC", "ND"] as const
export const TOC_V1_ITEM_TYPES = [
  "Service",
  "Product",
  "TaxDescriptor",
] as const
export const TOC_EXTRA_COUNTRY_CODES = ["PT-AC", "PT-MA"] as const

export type ToconlineV1DocumentType = (typeof TOC_V1_DOCUMENT_TYPES)[number]
export type ToconlineV1ItemType = (typeof TOC_V1_ITEM_TYPES)[number]

export interface MapIssueInvoiceOptions {
  documentSeriesId?: string
  documentSeriesPrefix?: string
  customerId?: string
  taxId?: string
  /** Already-resolved exemption reason id (lookup by legal code). */
  taxExemptionReasonId?: string
  currencyId?: string
}

export interface ToconlineV1LinePayload {
  item_type: ToconlineV1ItemType
  description: string
  quantity: number
  unit_price: number
  tax_code: string
  tax_percentage: number
  tax_id?: string
}

export interface ToconlineV1SalesDocumentPayload {
  document_type: ToconlineV1DocumentType
  date: string
  customer_business_name: string
  customer_tax_registration_number: string
  customer_country: string
  customer_address_detail?: string
  customer_id?: string
  payment_mechanism: "MO"
  vat_included_prices: false
  currency_iso_code: string
  currency_id?: string
  notes?: string
  external_reference: string
  document_series_id?: string
  document_series_prefix?: string
  tax_exemption_reason_id?: string
  lines: ToconlineV1LinePayload[]
}

type InvoiceLine = IssueInvoiceInput["lines"][number]
type TaxTreatment = NonNullable<InvoiceLine["taxTreatment"]>

export function exemptionLegalCode(
  treatment: TaxTreatment
): string | undefined {
  switch (treatment) {
    case "standard":
      return undefined
    case "exempt":
      throw new AdapterError(
        "validation",
        "exempt lines need an explicit IVA exemption code from the payments spec"
      )
    case "reverse_charge":
      return "M07"
    case "zero_rated":
      return "M99"
    default: {
      const _exhaustive: never = treatment
      throw new AdapterError(
        "validation",
        `unknown tax treatment: ${_exhaustive}`
      )
    }
  }
}

function toV1Line(
  line: InvoiceLine,
  taxId?: string
): { payload: ToconlineV1LinePayload; exemptionLegalCode?: string } {
  const treatment = line.taxTreatment ?? "standard"
  const base = {
    item_type: "Service" as const,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unitPrice,
  }
  switch (treatment) {
    case "standard":
      return {
        payload: {
          ...base,
          tax_code: "NOR",
          tax_percentage: line.taxRate,
          ...(taxId ? { tax_id: taxId } : {}),
        },
      }
    case "reverse_charge":
    case "zero_rated":
    case "exempt":
      return {
        payload: {
          ...base,
          tax_code: "ISE",
          tax_percentage: 0,
          ...(taxId ? { tax_id: taxId } : {}),
        },
        exemptionLegalCode: exemptionLegalCode(treatment),
      }
    default: {
      const _exhaustive: never = treatment
      throw new AdapterError(
        "validation",
        `unknown tax treatment: ${_exhaustive}`
      )
    }
  }
}

export function mapIssueInvoiceToV1Payload(
  input: IssueInvoiceInput,
  options: MapIssueInvoiceOptions = {}
): ToconlineV1SalesDocumentPayload {
  const parsed = IssueInvoiceInput.safeParse(input)
  if (!parsed.success) {
    throw new AdapterError(
      "validation",
      parsed.error.issues[0]?.message ?? "invalid invoice payload"
    )
  }
  const invoice = parsed.data
  const mapped = invoice.lines.map((line) => toV1Line(line, options.taxId))
  const treatments = new Set(
    invoice.lines.map((line) => line.taxTreatment ?? "standard")
  )
  if (treatments.size > 1) {
    throw new AdapterError(
      "validation",
      "TOConline documents cannot mix incompatible IVA treatments"
    )
  }

  const currency = invoice.lines[0]?.currency ?? "EUR"
  const payload: ToconlineV1SalesDocumentPayload = {
    document_type: "FT",
    date: invoice.date,
    customer_business_name: invoice.member.name,
    customer_tax_registration_number: invoice.member.fiscalId || "999999990",
    customer_country: invoice.member.country,
    payment_mechanism: "MO",
    vat_included_prices: false,
    currency_iso_code: currency,
    notes: invoice.notes,
    external_reference: invoice.bookingId,
    lines: mapped.map((line) => line.payload),
  }
  if (invoice.member.address) {
    payload.customer_address_detail = invoice.member.address
  }
  if (options.documentSeriesId) {
    payload.document_series_id = options.documentSeriesId
  }
  if (options.documentSeriesPrefix) {
    payload.document_series_prefix = options.documentSeriesPrefix
  }
  if (options.customerId) {
    payload.customer_id = options.customerId
  }
  if (options.currencyId) {
    payload.currency_id = options.currencyId
  }
  if (options.taxExemptionReasonId) {
    payload.tax_exemption_reason_id = options.taxExemptionReasonId
  }
  return payload
}
