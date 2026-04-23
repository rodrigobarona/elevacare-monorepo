import { sql } from "drizzle-orm"
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt } from "./shared"

export const outboxStatusEnum = pgEnum("audit_outbox_status", [
  "pending",
  "shipped",
  "failed",
])

/**
 * Transactional outbox for the audit pipeline (ADR-003).
 *
 * Written atomically with the domain change inside the same main-DB
 * transaction by @eleva/audit.withAudit(). Drained asynchronously by
 * packages/workflows/src/workflows/audit-outbox-drainer.ts into
 * eleva_v3_audit.audit_events with idempotent audit_id.
 *
 * RLS: rows are tenant-scoped by org_id. Only the drainer role may
 * UPDATE rows (to mark shipped); other roles insert + select own.
 */
export const auditOutbox = pgTable(
  "audit_outbox",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    auditId: uuid("audit_id").notNull(),
    orgId: uuid("org_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 64 }).notNull(),
    entityId: text("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    correlationId: varchar("correlation_id", { length: 64 }),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => ({
    auditIdIdx: uniqueIndex("audit_outbox_audit_id_idx").on(t.auditId),
  })
)

export type AuditOutboxRow = typeof auditOutbox.$inferSelect
export type NewAuditOutboxRow = typeof auditOutbox.$inferInsert
