import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn } from "./shared"
import { organization } from "../auth"

export const domainEventDeliveryStatusEnum = pgEnum(
  "domain_event_delivery_status",
  ["pending", "processing", "succeeded", "failed", "dead"]
)

/**
 * Transactional outbox for durable domain events (Phase 04.2d).
 * Inserted in the same Drizzle transaction as the domain write.
 * org_id is required for tenant RLS even though the phase spec listed
 * only id/type/payload/idempotency_key/timestamps.
 */
export const domainEventsOutbox = pgTable(
  "domain_events_outbox",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => ({
    idempotencyKey: unique("domain_events_outbox_idempotency_key").on(
      t.idempotencyKey
    ),
    orgIdx: index("domain_events_outbox_org_idx").on(t.orgId),
    unpublishedIdx: index("domain_events_outbox_unpublished_idx")
      .on(t.createdAt)
      .where(sql`published_at IS NULL`),
    payloadChk: check(
      "domain_events_outbox_payload_object",
      sql`jsonb_typeof(payload) = 'object'`
    ),
    tenantPolicy: pgPolicy("domain_events_outbox_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
  })
)

export const domainEventDeliveries = pgTable(
  "domain_event_deliveries",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => domainEventsOutbox.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id").notNull(),
    status: domainEventDeliveryStatusEnum("status")
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastError: text("last_error"),
  },
  (t) => ({
    eventSubscriberKey: unique(
      "domain_event_deliveries_event_subscriber_key"
    ).on(t.eventId, t.subscriberId),
    orgIdx: index("domain_event_deliveries_org_idx").on(t.orgId),
    claimIdx: index("domain_event_deliveries_claim_idx")
      .on(t.status, t.attempts)
      .where(sql`status IN ('pending', 'failed', 'processing')`),
    attemptsChk: check("domain_event_deliveries_attempts", sql`attempts >= 0`),
    tenantPolicy: pgPolicy("domain_event_deliveries_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
  })
)

export type DomainEventOutboxRow = typeof domainEventsOutbox.$inferSelect
export type DomainEventDeliveryRow = typeof domainEventDeliveries.$inferSelect
