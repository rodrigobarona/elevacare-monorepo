import { sql } from "drizzle-orm"
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  unique,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, pkColumn } from "./shared"

/**
 * Platform Stripe vs expert-invoice reconciliation runs (Phase 07.2).
 *
 * RLS class: service-only. Staff and the monthly QStash job read/write
 * through `withPlatformAdminContext`. No tenant `org_id` — one row per
 * Lisbon calendar month. Does not store TOConline documents and does not
 * imply that commercial sales documents were posted.
 */
export const accountingReconciliationStatusEnum = pgEnum(
  "accounting_reconciliation_status",
  ["matched", "mismatch"]
)

export type AccountingReconciliationStatus =
  (typeof accountingReconciliationStatusEnum.enumValues)[number]

export type AccountingReconciliationDetails = {
  comparison: "expert_invoices"
  issuanceGateClosed: true
  stripeGrossCents: number
  invoicedCents: number
  issuedExportCents: number
  missingInvoiceCount: number
  extraInvoiceCount: number
  amountMismatchCount: number
  failedInvoiceCount: number
  pendingInvoiceCount: number
  blockedInvoiceCount: number
  tier1Skipped: true
}

export const accountingReconciliationRuns = pgTable(
  "accounting_reconciliation_runs",
  {
    id: pkColumn(),
    month: varchar("month", { length: 7 }).notNull(),
    stripeFeeTotalCents: integer("stripe_fee_total_cents").notNull(),
    invoicedTotalCents: integer("invoiced_total_cents").notNull(),
    mismatchBps: integer("mismatch_bps").notNull(),
    status: accountingReconciliationStatusEnum("status").notNull(),
    details: jsonb("details")
      .$type<AccountingReconciliationDetails>()
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    monthKey: unique("accounting_reconciliation_runs_month_key").on(t.month),
    monthChk: check(
      "accounting_reconciliation_runs_month",
      sql`month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`
    ),
    feeChk: check(
      "accounting_reconciliation_runs_fee",
      sql`stripe_fee_total_cents >= 0`
    ),
    invoicedChk: check(
      "accounting_reconciliation_runs_invoiced",
      sql`invoiced_total_cents >= 0`
    ),
    mismatchChk: check(
      "accounting_reconciliation_runs_mismatch",
      sql`mismatch_bps >= 0`
    ),
    servicePolicy: pgPolicy("accounting_reconciliation_runs_service_only", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')`,
    }),
  })
)

export type AccountingReconciliationRun =
  typeof accountingReconciliationRuns.$inferSelect
export type NewAccountingReconciliationRun =
  typeof accountingReconciliationRuns.$inferInsert
