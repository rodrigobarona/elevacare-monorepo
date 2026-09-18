import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organization } from "../auth"
import { bookingPayments } from "./bookings"
import { billingSubscriptions } from "./billing"
import { bookingRefunds } from "./payouts"

/**
 * Tier 1 Eleva → expert platform-fee invoices (Phase 07.1).
 *
 * RLS class: tenant-owned, with platform_admin bypass so Stripe webhooks
 * can insert pending rows. Live TOConline v1 POST stays closed.
 *
 * `iva_regime` is a conservative classifier, not a signed automatic table:
 * EU without VIES is `eu_unclassified` (not auto-consumer); extra-EU is
 * `extra_eu_unclassified` (not indiscriminate zero-rate); VIES downtime
 * is `vies_unavailable`. Closed-gate orchestration records `blocked`
 * (v1 POST refused) or `skipped` (IVA queued / zero fee / D-09).
 */
export const platformFeeInvoiceStatusEnum = pgEnum(
  "platform_fee_invoice_status",
  [
    "pending",
    "issued",
    "failed",
    "blocked",
    "skipped",
    "dead_lettered",
    "credited",
    "legacy",
    "legacy_missing",
  ]
)

export const platformFeeIvaRegimeEnum = pgEnum("platform_fee_iva_regime", [
  "pending",
  "pt_territorial",
  "eu_reverse_charge",
  "eu_unclassified",
  "extra_eu_unclassified",
  "vies_unavailable",
])

export const platformFeeAtStatusEnum = pgEnum("platform_fee_at_status", [
  "operator_gated",
  "not_applicable",
  "communicated",
  "failed",
])

export const platformFeeCreditNoteStatusEnum = pgEnum(
  "platform_fee_credit_note_status",
  ["pending", "issued", "failed", "blocked"]
)

export const platformFeeCreditNoteReasonEnum = pgEnum(
  "platform_fee_credit_note_reason",
  ["commission_reduction"]
)

export const clinicSaasInvoiceStatusEnum = pgEnum(
  "clinic_saas_invoice_status",
  ["pending", "issued", "failed", "dead_lettered", "credited"]
)

const tenantAdminPolicy = {
  using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
  withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
}

export const platformFeeInvoices = pgTable(
  "platform_fee_invoices",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "restrict",
    }),
    bookingPaymentId: uuid("booking_payment_id").notNull(),
    expertOrgId: uuid("expert_org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    series: varchar("series", { length: 64 }),
    number: varchar("number", { length: 64 }),
    toconlineDocumentId: varchar("toconline_document_id", { length: 255 }),
    amountCents: integer("amount_cents").notNull(),
    ivaRateBps: integer("iva_rate_bps").notNull().default(0),
    ivaRegime: platformFeeIvaRegimeEnum("iva_regime")
      .notNull()
      .default("pending"),
    status: platformFeeInvoiceStatusEnum("status").notNull().default("pending"),
    legacyDocumentRef: varchar("legacy_document_ref", { length: 255 }),
    pdfUrl: text("pdf_url"),
    atStatus: platformFeeAtStatusEnum("at_status")
      .notNull()
      .default("operator_gated"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("platform_fee_invoices_org_idx").on(t.orgId),
    statusIdx: index("platform_fee_invoices_status_idx").on(t.status),
    createdIdx: index("platform_fee_invoices_created_idx").on(t.createdAt),
    paymentOrgFk: foreignKey({
      name: "platform_fee_invoices_payment_org_fk",
      columns: [t.bookingPaymentId, t.orgId],
      foreignColumns: [bookingPayments.id, bookingPayments.orgId],
    }).onDelete("restrict"),
    paymentKey: unique("platform_fee_invoices_payment_key").on(
      t.bookingPaymentId
    ),
    idOrgKey: unique("platform_fee_invoices_id_org_key").on(t.id, t.orgId),
    expertOrgChk: check(
      "platform_fee_invoices_expert_org",
      sql`org_id = expert_org_id`
    ),
    amountChk: check("platform_fee_invoices_amount", sql`amount_cents >= 0`),
    ivaRateChk: check(
      "platform_fee_invoices_iva_rate",
      sql`iva_rate_bps >= 0 AND iva_rate_bps <= 10000`
    ),
    attemptsChk: check("platform_fee_invoices_attempts", sql`attempts >= 0`),
    tenantPolicy: pgPolicy(
      "platform_fee_invoices_tenant_isolation",
      tenantAdminPolicy
    ),
  })
)

export const platformFeeCreditNotes = pgTable(
  "platform_fee_credit_notes",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "restrict",
    }),
    platformFeeInvoiceId: uuid("platform_fee_invoice_id").notNull(),
    bookingRefundId: uuid("booking_refund_id").notNull(),
    reason: platformFeeCreditNoteReasonEnum("reason")
      .notNull()
      .default("commission_reduction"),
    amountCents: integer("amount_cents").notNull(),
    series: varchar("series", { length: 64 }),
    number: varchar("number", { length: 64 }),
    toconlineDocumentId: varchar("toconline_document_id", { length: 255 }),
    status: platformFeeCreditNoteStatusEnum("status")
      .notNull()
      .default("pending"),
    error: text("error"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("platform_fee_credit_notes_org_idx").on(t.orgId),
    refundIdx: index("platform_fee_credit_notes_refund_idx").on(
      t.bookingRefundId
    ),
    invoiceOrgFk: foreignKey({
      name: "platform_fee_credit_notes_invoice_org_fk",
      columns: [t.platformFeeInvoiceId, t.orgId],
      foreignColumns: [platformFeeInvoices.id, platformFeeInvoices.orgId],
    }).onDelete("restrict"),
    refundOrgFk: foreignKey({
      name: "platform_fee_credit_notes_refund_org_fk",
      columns: [t.bookingRefundId, t.orgId],
      foreignColumns: [bookingRefunds.id, bookingRefunds.orgId],
    }).onDelete("restrict"),
    idOrgKey: unique("platform_fee_credit_notes_id_org_key").on(t.id, t.orgId),
    refundKey: unique("platform_fee_credit_notes_refund_key").on(
      t.bookingRefundId
    ),
    amountChk: check("platform_fee_credit_notes_amount", sql`amount_cents > 0`),
    tenantPolicy: pgPolicy(
      "platform_fee_credit_notes_tenant_isolation",
      tenantAdminPolicy
    ),
  })
)

export const clinicSaasInvoices = pgTable(
  "clinic_saas_invoices",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "restrict",
    }),
    billingSubscriptionId: uuid("billing_subscription_id").notNull(),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).notNull(),
    series: varchar("series", { length: 64 }),
    number: varchar("number", { length: 64 }),
    toconlineDocumentId: varchar("toconline_document_id", { length: 255 }),
    amountCents: integer("amount_cents").notNull(),
    ivaRateBps: integer("iva_rate_bps").notNull().default(0),
    ivaRegime: platformFeeIvaRegimeEnum("iva_regime")
      .notNull()
      .default("pending"),
    status: clinicSaasInvoiceStatusEnum("status").notNull().default("pending"),
    pdfUrl: text("pdf_url"),
    atStatus: platformFeeAtStatusEnum("at_status")
      .notNull()
      .default("operator_gated"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("clinic_saas_invoices_org_idx").on(t.orgId),
    statusIdx: index("clinic_saas_invoices_status_idx").on(t.status),
    subscriptionOrgFk: foreignKey({
      name: "clinic_saas_invoices_subscription_org_fk",
      columns: [t.billingSubscriptionId, t.orgId],
      foreignColumns: [billingSubscriptions.id, billingSubscriptions.orgId],
    }).onDelete("restrict"),
    stripeKey: unique("clinic_saas_invoices_stripe_key").on(t.stripeInvoiceId),
    idOrgKey: unique("clinic_saas_invoices_id_org_key").on(t.id, t.orgId),
    amountChk: check("clinic_saas_invoices_amount", sql`amount_cents >= 0`),
    ivaRateChk: check(
      "clinic_saas_invoices_iva_rate",
      sql`iva_rate_bps >= 0 AND iva_rate_bps <= 10000`
    ),
    attemptsChk: check("clinic_saas_invoices_attempts", sql`attempts >= 0`),
    tenantPolicy: pgPolicy(
      "clinic_saas_invoices_tenant_isolation",
      tenantAdminPolicy
    ),
  })
)

export type PlatformFeeInvoice = typeof platformFeeInvoices.$inferSelect
export type NewPlatformFeeInvoice = typeof platformFeeInvoices.$inferInsert
export type PlatformFeeInvoiceStatus =
  (typeof platformFeeInvoiceStatusEnum.enumValues)[number]
export type PlatformFeeIvaRegime =
  (typeof platformFeeIvaRegimeEnum.enumValues)[number]
export type PlatformFeeCreditNote = typeof platformFeeCreditNotes.$inferSelect
export type ClinicSaasInvoice = typeof clinicSaasInvoices.$inferSelect
