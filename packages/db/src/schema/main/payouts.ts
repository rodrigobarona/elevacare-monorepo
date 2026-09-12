import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organization, user } from "../auth"
import { bookingPayments } from "./bookings"

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "scheduled",
  "approval_required",
  "transferred",
  "paid_out",
  "failed",
  "held",
  "reversal_pending",
  "reversed",
])

export const payoutHoldReasonEnum = pgEnum("payout_hold_reason", [
  "dispute",
  "manual",
])

export const BOOKING_PAYMENT_DISPUTE_STATUSES = [
  "none",
  "open",
  "won",
  "lost",
] as const

export const refundStatusEnum = pgEnum("booking_refund_status", [
  "pending",
  "succeeded",
  "failed",
])

export const transferReversalStatusEnum = pgEnum("transfer_reversal_status", [
  "pending",
  "succeeded",
  "failed",
])

export const workflowDeadLetterStatusEnum = pgEnum(
  "workflow_dead_letter_status",
  ["open", "replayed", "discarded"]
)

/**
 * Per-booking payout ledger. `org_id` is the expert org (RLS).
 * `destination_org_id` + `destination_connect_account_id` are an
 * immutable snapshot written at insert (Phase 11 may snapshot a clinic).
 */
export const payoutStates = pgTable(
  "payout_states",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    bookingPaymentId: uuid("booking_payment_id")
      .notNull()
      .references(() => bookingPayments.id, { onDelete: "restrict" }),
    expertOrgId: uuid("expert_org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    destinationOrgId: uuid("destination_org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    destinationConnectAccountId: varchar("destination_connect_account_id", {
      length: 255,
    }).notNull(),
    status: payoutStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    reversedCents: integer("reversed_cents").notNull().default(0),
    eligibleAt: timestamp("eligible_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    }),
    transferIdempotencyKey: uuid("transfer_idempotency_key")
      .notNull()
      .default(sql`gen_random_uuid()`),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    stripePayoutId: varchar("stripe_payout_id", { length: 255 }),
    holdReasons: text("hold_reasons")
      .array()
      .notNull()
      .$defaultFn(() => []),
    heldFromStatus: payoutStatusEnum("held_from_status"),
    approvedBy: uuid("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("payout_states_org_idx").on(t.orgId),
    bookingPaymentKey: unique("payout_states_booking_payment_id_key").on(
      t.bookingPaymentId
    ),
    idOrgKey: unique("payout_states_id_org_key").on(t.id, t.orgId),
    idPaymentKey: unique("payout_states_id_payment_key").on(
      t.id,
      t.bookingPaymentId
    ),
    statusIdx: index("payout_states_status_idx").on(t.status),
    destinationIdx: index("payout_states_destination_idx").on(
      t.destinationConnectAccountId
    ),
    transferKeyIdx: unique("payout_states_transfer_idempotency_key").on(
      t.transferIdempotencyKey
    ),
    amountChk: check("payout_states_amount", sql`amount_cents >= 0`),
    reversedChk: check(
      "payout_states_reversed_cents",
      sql`reversed_cents >= 0 AND reversed_cents <= amount_cents`
    ),
    holdReasonsChk: check(
      "payout_states_hold_reasons",
      sql`hold_reasons <@ ARRAY['dispute','manual']::text[]`
    ),
    expertOrgChk: check(
      "payout_states_expert_org",
      sql`org_id = expert_org_id`
    ),
    paymentOrgFk: foreignKey({
      name: "payout_states_payment_org_fk",
      columns: [t.bookingPaymentId, t.orgId],
      foreignColumns: [bookingPayments.id, bookingPayments.orgId],
    }),
    tenantPolicy: pgPolicy("payout_states_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export const bookingRefunds = pgTable(
  "booking_refunds",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    bookingPaymentId: uuid("booking_payment_id")
      .notNull()
      .references(() => bookingPayments.id, { onDelete: "restrict" }),
    stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
    amountCents: integer("amount_cents").notNull(),
    status: refundStatusEnum("status").notNull().default("pending"),
    reason: text("reason").notNull(),
    refundSeq: integer("refund_seq").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("booking_refunds_org_idx").on(t.orgId),
    paymentIdx: index("booking_refunds_payment_idx").on(t.bookingPaymentId),
    seqKey: unique("booking_refunds_payment_seq_key").on(
      t.bookingPaymentId,
      t.refundSeq
    ),
    idempotencyKey: unique("booking_refunds_idempotency_key").on(
      t.idempotencyKey
    ),
    stripeIdx: uniqueIndex("booking_refunds_stripe_refund_id_key")
      .on(t.stripeRefundId)
      .where(sql`stripe_refund_id IS NOT NULL`),
    idOrgKey: unique("booking_refunds_id_org_key").on(t.id, t.orgId),
    idPaymentKey: unique("booking_refunds_id_payment_key").on(
      t.id,
      t.bookingPaymentId
    ),
    paymentOrgFk: foreignKey({
      name: "booking_refunds_payment_org_fk",
      columns: [t.bookingPaymentId, t.orgId],
      foreignColumns: [bookingPayments.id, bookingPayments.orgId],
    }),
    amountChk: check("booking_refunds_amount", sql`amount_cents > 0`),
    tenantPolicy: pgPolicy("booking_refunds_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export const transferReversals = pgTable(
  "transfer_reversals",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    payoutStateId: uuid("payout_state_id")
      .notNull()
      .references(() => payoutStates.id, { onDelete: "restrict" }),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => bookingRefunds.id, { onDelete: "restrict" }),
    bookingPaymentId: uuid("booking_payment_id").notNull(),
    stripeReversalId: varchar("stripe_reversal_id", { length: 255 }),
    amountCents: integer("amount_cents").notNull(),
    status: transferReversalStatusEnum("status").notNull().default("pending"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("transfer_reversals_org_idx").on(t.orgId),
    payoutIdx: index("transfer_reversals_payout_idx").on(t.payoutStateId),
    refundKey: unique("transfer_reversals_refund_id_key").on(t.refundId),
    amountChk: check("transfer_reversals_amount", sql`amount_cents >= 0`),
    payoutOrgFk: foreignKey({
      name: "transfer_reversals_payout_org_fk",
      columns: [t.payoutStateId, t.orgId],
      foreignColumns: [payoutStates.id, payoutStates.orgId],
    }),
    refundOrgFk: foreignKey({
      name: "transfer_reversals_refund_org_fk",
      columns: [t.refundId, t.orgId],
      foreignColumns: [bookingRefunds.id, bookingRefunds.orgId],
    }),
    payoutPaymentFk: foreignKey({
      name: "transfer_reversals_payout_payment_fk",
      columns: [t.payoutStateId, t.bookingPaymentId],
      foreignColumns: [payoutStates.id, payoutStates.bookingPaymentId],
    }),
    refundPaymentFk: foreignKey({
      name: "transfer_reversals_refund_payment_fk",
      columns: [t.refundId, t.bookingPaymentId],
      foreignColumns: [bookingRefunds.id, bookingRefunds.bookingPaymentId],
    }),
    tenantPolicy: pgPolicy("transfer_reversals_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export const workflowDeadLetters = pgTable(
  "workflow_dead_letters",
  {
    id: pkColumn(),
    orgId: uuid("org_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    workflowName: varchar("workflow_name", { length: 128 }).notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .$defaultFn(() => ({})),
    status: workflowDeadLetterStatusEnum("status").notNull().default("open"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    workflowIdx: index("workflow_dead_letters_workflow_idx").on(t.workflowName),
    statusIdx: index("workflow_dead_letters_status_idx").on(t.status),
    tenantPolicy: pgPolicy("workflow_dead_letters_tenant_isolation", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')`,
    }),
  })
)

export type PayoutState = typeof payoutStates.$inferSelect
export type NewPayoutState = typeof payoutStates.$inferInsert
export type PayoutStatus = (typeof payoutStatusEnum.enumValues)[number]
export type PayoutHoldReason = (typeof payoutHoldReasonEnum.enumValues)[number]
export type BookingRefund = typeof bookingRefunds.$inferSelect
export type TransferReversal = typeof transferReversals.$inferSelect
export type WorkflowDeadLetter = typeof workflowDeadLetters.$inferSelect
export type BookingPaymentDisputeStatus =
  (typeof BOOKING_PAYMENT_DISPUTE_STATUSES)[number]
