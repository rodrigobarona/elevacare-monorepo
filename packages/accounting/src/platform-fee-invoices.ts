/**
 * Staff listing for Eleva → expert platform-fee invoices (Phase 07.1).
 * Lives in `@eleva/accounting` with the rest of the invoicing domain
 * (Tier 1 platform-fee ledger + Tier 2 adapters). Does not POST
 * TOConline v1 sales documents.
 */

import { and, desc, eq, gte, lt, sql } from "drizzle-orm"
import { main, withPlatformAdminContext } from "@eleva/db"
import { previousLisbonMonth } from "./reconciliation"
import { parseSaftMonth, saftMonthRange } from "./saft-export"

export const PLATFORM_FEE_INVOICE_PAGE_SIZE = 50

export type PlatformFeeInvoiceStatus =
  (typeof main.platformFeeInvoices.$inferSelect)["status"]
export type PlatformFeeIvaRegime =
  (typeof main.platformFeeInvoices.$inferSelect)["ivaRegime"]
export type PlatformFeeAtStatus =
  (typeof main.platformFeeInvoices.$inferSelect)["atStatus"]

export type PublicPlatformFeeInvoice = {
  id: string
  bookingPaymentId: string
  expertOrgId: string
  status: PlatformFeeInvoiceStatus
  ivaRegime: PlatformFeeIvaRegime
  amountCents: number
  ivaRateBps: number
  series: string | null
  number: string | null
  atStatus: PlatformFeeAtStatus
  issuedAt: string | null
  error: string | null
  attempts: number
}

type PlatformFeeInvoiceRow = {
  id: string
  bookingPaymentId: string
  expertOrgId: string
  status: PlatformFeeInvoiceStatus
  ivaRegime: PlatformFeeIvaRegime
  amountCents: number
  ivaRateBps: number
  series: string | null
  number: string | null
  atStatus: PlatformFeeAtStatus
  issuedAt: Date | null
  error: string | null
  attempts: number
}

const invoiceSelect = {
  id: main.platformFeeInvoices.id,
  bookingPaymentId: main.platformFeeInvoices.bookingPaymentId,
  expertOrgId: main.platformFeeInvoices.expertOrgId,
  status: main.platformFeeInvoices.status,
  ivaRegime: main.platformFeeInvoices.ivaRegime,
  amountCents: main.platformFeeInvoices.amountCents,
  ivaRateBps: main.platformFeeInvoices.ivaRateBps,
  series: main.platformFeeInvoices.series,
  number: main.platformFeeInvoices.number,
  atStatus: main.platformFeeInvoices.atStatus,
  issuedAt: main.platformFeeInvoices.issuedAt,
  error: main.platformFeeInvoices.error,
  attempts: main.platformFeeInvoices.attempts,
}

export function toPublicPlatformFeeInvoice(
  row: PlatformFeeInvoiceRow
): PublicPlatformFeeInvoice {
  return {
    id: row.id,
    bookingPaymentId: row.bookingPaymentId,
    expertOrgId: row.expertOrgId,
    status: row.status,
    ivaRegime: row.ivaRegime,
    amountCents: row.amountCents,
    ivaRateBps: row.ivaRateBps,
    series: row.series,
    number: row.number,
    atStatus: row.atStatus,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    error: row.error,
    attempts: row.attempts,
  }
}

export async function listPlatformFeeInvoices(input: {
  month?: string
  status?: PlatformFeeInvoiceStatus
  cursor?: string
}): Promise<{
  month: string
  invoices: PublicPlatformFeeInvoice[]
  nextCursor: string | null
}> {
  const month = input.month ?? previousLisbonMonth(new Date())
  parseSaftMonth(month)
  const range = saftMonthRange(month)

  return withPlatformAdminContext(async (tx) => {
    const rangeFilters = [
      gte(main.platformFeeInvoices.createdAt, range.start),
      lt(main.platformFeeInvoices.createdAt, range.end),
    ]
    const filters = [...rangeFilters]
    if (input.status) {
      filters.push(eq(main.platformFeeInvoices.status, input.status))
    }
    if (input.cursor) {
      const [cursorRow] = await tx
        .select({
          id: main.platformFeeInvoices.id,
          createdAt: main.platformFeeInvoices.createdAt,
        })
        .from(main.platformFeeInvoices)
        .where(
          and(eq(main.platformFeeInvoices.id, input.cursor), ...rangeFilters)
        )
        .limit(1)
      if (!cursorRow) {
        return { month, invoices: [], nextCursor: null }
      }
      filters.push(
        sql`(${main.platformFeeInvoices.createdAt}, ${main.platformFeeInvoices.id}) < (${cursorRow.createdAt}, ${cursorRow.id})`
      )
    }

    const rows = await tx
      .select(invoiceSelect)
      .from(main.platformFeeInvoices)
      .where(and(...filters))
      .orderBy(
        desc(main.platformFeeInvoices.createdAt),
        desc(main.platformFeeInvoices.id)
      )
      .limit(PLATFORM_FEE_INVOICE_PAGE_SIZE + 1)

    const page = rows.slice(0, PLATFORM_FEE_INVOICE_PAGE_SIZE)
    return {
      month,
      invoices: page.map(toPublicPlatformFeeInvoice),
      nextCursor:
        rows.length > PLATFORM_FEE_INVOICE_PAGE_SIZE
          ? (page[page.length - 1]?.id ?? null)
          : null,
    }
  })
}
