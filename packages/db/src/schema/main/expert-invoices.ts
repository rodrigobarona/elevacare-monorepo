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
import { bookings } from "./bookings"
import { invoicingProviderEnum } from "./expert-profiles"

/**
 * Tier 2 expert → member invoice log (ADR-013).
 *
 * RLS class: tenant-owned, with platform_admin bypass so the Stripe
 * webhook handler can insert `pending` rows.
 */
export const expertInvoiceStatusEnum = pgEnum("expert_invoice_status", [
  "pending",
  "issued",
  "failed",
  "manual_pending",
  "manual_issued",
])

export const expertInvoices = pgTable(
  "expert_invoices",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id").notNull(),
    expertOrgId: uuid("expert_org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    adapter: invoicingProviderEnum("adapter").notNull(),
    externalId: varchar("external_id", { length: 255 }),
    number: varchar("number", { length: 64 }),
    amountCents: integer("amount_cents").notNull(),
    memberNif: varchar("member_nif", { length: 32 }),
    status: expertInvoiceStatusEnum("status").notNull().default("pending"),
    pdfUrl: text("pdf_url"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("expert_invoices_org_idx").on(t.orgId),
    statusIdx: index("expert_invoices_status_idx").on(t.status),
    bookingOrgFk: foreignKey({
      name: "expert_invoices_booking_org_fk",
      columns: [t.bookingId, t.orgId],
      foreignColumns: [bookings.id, bookings.orgId],
    }).onDelete("restrict"),
    bookingExpertKey: unique("expert_invoices_booking_expert_key").on(
      t.bookingId,
      t.expertOrgId
    ),
    idOrgKey: unique("expert_invoices_id_org_key").on(t.id, t.orgId),
    expertOrgChk: check(
      "expert_invoices_expert_org",
      sql`org_id = expert_org_id`
    ),
    amountChk: check("expert_invoices_amount", sql`amount_cents >= 0`),
    attemptsChk: check("expert_invoices_attempts", sql`attempts >= 0`),
    tenantPolicy: pgPolicy("expert_invoices_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type ExpertInvoice = typeof expertInvoices.$inferSelect
export type NewExpertInvoice = typeof expertInvoices.$inferInsert
export type ExpertInvoiceStatus =
  (typeof expertInvoiceStatusEnum.enumValues)[number]
