import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

/**
 * Append-only audit stream living in the SECOND Neon project
 * (eleva_v3_audit). Populated by the auditOutboxDrainer workflow; never
 * written to from app code directly.
 *
 * RLS rules (installed by src/rls/apply-rls.ts):
 * - INSERT: allowed by drainer role only
 * - SELECT: org_id match OR capability 'audit:view_all'
 * - UPDATE/DELETE: revoked entirely \u2014 the table is append-only at the
 *   policy level + at the role grant level.
 *
 * Optional hash-chain fields (prev_hash / row_hash) are provisioned in
 * Sprint 7 hardening. Currently nullable.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    auditId: uuid("audit_id").notNull().unique(),
    orgId: uuid("org_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 64 }).notNull(),
    entityId: text("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    correlationId: varchar("correlation_id", { length: 64 }),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    // S7 hardening: hash chain for tamper-evident auditing.
    prevHash: text("prev_hash"),
    rowHash: text("row_hash"),
  },
  (t) => ({
    orgIdx: index("audit_events_org_idx").on(t.orgId),
    entityIdx: index("audit_events_entity_idx").on(t.entity, t.entityId),
    receivedIdx: index("audit_events_received_idx").on(t.receivedAt),
  })
)

export type AuditEvent = typeof auditEvents.$inferSelect
export type NewAuditEvent = typeof auditEvents.$inferInsert
