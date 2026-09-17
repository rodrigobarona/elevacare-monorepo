import { createHmac, timingSafeEqual } from "node:crypto"
import { and, asc, eq, sql } from "drizzle-orm"
import { main, withOrgContext } from "@eleva/db"
import type { ExpertInvoiceStatus } from "./invoice-ops"

/**
 * Monthly CSV + SAF-T PT skeleton for expert → member invoices.
 * Lives in `@eleva/accounting` with the manual adapter (ADR-013 / Phase 07.2).
 * This is not a TOConline importer and does not POST sales documents.
 */

export const LISBON_TZ = "Europe/Lisbon"
export const SAFT_EXPORT_MAX_ROWS = 5_000
export const SAFT_SIGNED_URL_TTL_SECONDS = 60 * 60
export const SAFT_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export type SaftInvoiceRow = {
  id: string
  bookingId: string
  adapter: string
  status: ExpertInvoiceStatus
  number: string | null
  issuedAt: Date | null
  createdAt: Date
  amountCents: number
  memberNif: string | null
}

export type SaftMonthRange = {
  month: string
  start: Date
  end: Date
  startDate: string
  endDate: string
}

export class SaftExportError extends Error {
  readonly code: "invalid_month"
  readonly status: 422

  constructor(message: string) {
    super(message)
    this.name = "SaftExportError"
    this.code = "invalid_month"
    this.status = 422
  }
}

export function isSaftExportError(err: unknown): err is SaftExportError {
  return err instanceof SaftExportError
}

type LisbonParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function lisbonParts(date: Date): LisbonParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const bag = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value])
  )
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  }
}

function lisbonLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  for (let i = 0; i < 4; i += 1) {
    const parts = lisbonParts(utc)
    const asLisbon = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    )
    const wanted = Date.UTC(year, month - 1, day, hour, minute)
    utc = new Date(utc.getTime() + (wanted - asLisbon))
  }
  return utc
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function parseSaftMonth(month: string): { year: number; month: number } {
  const match = SAFT_MONTH_RE.exec(month)
  if (!match || Number(match[1]) < 2000 || Number(match[1]) > 2100) {
    throw new SaftExportError("month must be YYYY-MM")
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
  }
}

export function saftMonthRange(month: string): SaftMonthRange {
  const parsed = parseSaftMonth(month)
  const start = lisbonLocalToUtc(parsed.year, parsed.month, 1, 0, 0)
  const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year
  const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1
  const end = lisbonLocalToUtc(nextYear, nextMonth, 1, 0, 0)
  const lastDay = new Date(end.getTime() - 1)
  const lastParts = lisbonParts(lastDay)
  return {
    month,
    start,
    end,
    startDate: `${parsed.year}-${pad2(parsed.month)}-01`,
    endDate: `${lastParts.year}-${pad2(lastParts.month)}-${pad2(lastParts.day)}`,
  }
}

function lisbonDateKey(date: Date): string {
  const parts = lisbonParts(date)
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function lisbonDateTime(date: Date): string {
  const parts = lisbonParts(date)
  return `${lisbonDateKey(date)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`
}

function csvField(value: string): string {
  const safeValue = /^[\t\r\n=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replaceAll('"', '""')}"`
  }
  return safeValue
}

export function isIssuedSaftInvoice(row: SaftInvoiceRow): boolean {
  switch (row.status) {
    case "issued":
    case "manual_issued":
      return true
    case "pending":
    case "failed":
    case "manual_pending":
      return false
    default: {
      const _exhaustive: never = row.status
      void _exhaustive
      return false
    }
  }
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function buildSaftCsv(
  rows: readonly SaftInvoiceRow[],
  options: { truncated?: boolean } = {}
): string {
  const header = [
    "invoice_id",
    "booking_id",
    "adapter",
    "status",
    "number",
    "issued_at",
    "created_at",
    "amount_cents",
    "currency",
    "member_nif",
  ]
  const lines = [header.join(",")]
  for (const row of rows) {
    lines.push(
      [
        csvField(row.id),
        csvField(row.bookingId),
        csvField(row.adapter),
        csvField(row.status),
        csvField(row.number ?? ""),
        csvField(row.issuedAt ? row.issuedAt.toISOString() : ""),
        csvField(row.createdAt.toISOString()),
        csvField(String(row.amountCents)),
        csvField("EUR"),
        csvField(row.memberNif ?? ""),
      ].join(",")
    )
  }
  if (options.truncated) {
    lines.push(
      [
        csvField(
          `# truncated: export hit ${SAFT_EXPORT_MAX_ROWS}-row cap; later invoices omitted`
        ),
        ...Array.from({ length: header.length - 1 }, () => ""),
      ].join(",")
    )
  }
  return `${lines.join("\n")}\n`
}

export function buildSaftXmlSkeleton(input: {
  month: string
  rows: readonly SaftInvoiceRow[]
  truncated?: boolean
  generatedAt?: Date
}): string {
  const range = saftMonthRange(input.month)
  const generatedAt = input.generatedAt ?? new Date()
  const issuedRows = input.rows.filter(isIssuedSaftInvoice)
  const invoices = issuedRows
    .map((row) => {
      const occurredAt = row.issuedAt ?? row.createdAt
      const invoiceNo = xmlEscape(row.number || row.id)
      const taxId = xmlEscape(row.memberNif || "999999990")
      return [
        "      <Invoice>",
        `        <InvoiceNo>${invoiceNo}</InvoiceNo>`,
        "        <DocumentStatus>",
        "          <InvoiceStatus>N</InvoiceStatus>",
        `          <InvoiceStatusDate>${lisbonDateTime(occurredAt)}</InvoiceStatusDate>`,
        "          <SourceID>ELEVA</SourceID>",
        "          <SourceBilling>M</SourceBilling>",
        "        </DocumentStatus>",
        `        <InvoiceDate>${lisbonDateKey(occurredAt)}</InvoiceDate>`,
        "        <InvoiceType>FT</InvoiceType>",
        "        <SourceID>ELEVA</SourceID>",
        `        <SystemEntryDate>${lisbonDateTime(occurredAt)}</SystemEntryDate>`,
        `        <CustomerID>${taxId}</CustomerID>`,
        "      </Invoice>",
      ].join("\n")
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Eleva SAF-T PT skeleton. Not a certified AT file. Do not Comunicar or submit to AT. -->
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>ELEVA-SKELETON</CompanyID>
    <TaxRegistrationNumber>000000000</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>Eleva expert monthly export</CompanyName>
    <CompanyAddress>
      <AddressDetail>Replace with the expert certified software header</AddressDetail>
      <City>Lisboa</City>
      <PostalCode>0000-000</PostalCode>
      <Country>PT</Country>
    </CompanyAddress>
    <FiscalYear>${range.startDate.slice(0, 4)}</FiscalYear>
    <StartDate>${range.startDate}</StartDate>
    <EndDate>${range.endDate}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${lisbonDateKey(generatedAt)}</DateCreated>
    <ProductCompanyTaxID>000000000</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>ELEVA/SAFT-SKELETON</ProductID>
    <ProductVersion>0.1</ProductVersion>
  </Header>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${issuedRows.length}</NumberOfEntries>
      <!-- Totals omitted: IVA rates are unsigned. Amounts stay in CSV amount_cents. -->
${input.truncated ? `      <!-- truncated: export hit ${SAFT_EXPORT_MAX_ROWS}-row cap; later invoices omitted -->\n` : ""}${invoices}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>
`
}

export async function listSaftExportRows(input: {
  orgId: string
  month: string
}): Promise<{
  range: SaftMonthRange
  rows: SaftInvoiceRow[]
  truncated: boolean
}> {
  const range = saftMonthRange(input.month)
  return withOrgContext(input.orgId, async (tx) => {
    const occurredAt = sql`coalesce(${main.expertInvoices.issuedAt}, ${main.expertInvoices.createdAt})`
    const selected = await tx
      .select({
        id: main.expertInvoices.id,
        bookingId: main.expertInvoices.bookingId,
        adapter: main.expertInvoices.adapter,
        status: main.expertInvoices.status,
        number: main.expertInvoices.number,
        issuedAt: main.expertInvoices.issuedAt,
        createdAt: main.expertInvoices.createdAt,
        amountCents: main.expertInvoices.amountCents,
        memberNif: main.expertInvoices.memberNif,
      })
      .from(main.expertInvoices)
      .where(
        and(
          // CSV is the monthly work ledger (all statuses). XML drops
          // pending/failed rows so the skeleton never invents invoices.
          eq(main.expertInvoices.expertOrgId, input.orgId),
          sql`${occurredAt} >= ${range.start}`,
          sql`${occurredAt} < ${range.end}`
        )
      )
      .orderBy(asc(occurredAt), asc(main.expertInvoices.id))
      .limit(SAFT_EXPORT_MAX_ROWS + 1)

    const truncated = selected.length > SAFT_EXPORT_MAX_ROWS
    return {
      range,
      rows: selected.slice(0, SAFT_EXPORT_MAX_ROWS),
      truncated,
    }
  })
}

function saftSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to sign SAF-T download URLs"
    )
  }
  return secret
}

export function signSaftDownloadToken(input: {
  orgId: string
  month: string
  pathname: string
  exp: number
}): string {
  return createHmac("sha256", saftSigningSecret())
    .update(
      `saft-download\n${input.orgId}\n${input.month}\n${input.pathname}\n${input.exp}`
    )
    .digest("base64url")
}

export function verifySaftDownloadToken(input: {
  orgId: string
  month: string
  pathname: string
  exp: number
  signature: string
}): boolean {
  if (!Number.isFinite(input.exp) || input.exp * 1000 < Date.now()) {
    return false
  }
  if (
    input.pathname.includes("..") ||
    !input.pathname.startsWith(`invoicing-exports/${input.orgId}/`)
  ) {
    return false
  }
  const expected = Buffer.from(signSaftDownloadToken(input))
  const actual = Buffer.from(input.signature)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export function buildSaftDownloadUrl(input: {
  apiBaseUrl: string
  orgId: string
  month: string
  pathname: string
  expiresAt: Date
}): string {
  const exp = Math.floor(input.expiresAt.getTime() / 1000)
  const sig = signSaftDownloadToken({
    orgId: input.orgId,
    month: input.month,
    pathname: input.pathname,
    exp,
  })
  const base = input.apiBaseUrl.replace(/\/+$/, "")
  const params = new URLSearchParams({
    month: input.month,
    pathname: input.pathname,
    exp: String(exp),
    sig,
  })
  return `${base}/invoicing/exports/saft/file?${params.toString()}`
}

export function saftBlobPathname(orgId: string, month: string): string {
  return `invoicing-exports/${orgId}/saft-${month}.zip`
}
