import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import {
  createdAt,
  orgIdColumn,
  pkColumn,
  updatedAt,
  type LocalizedRichTextEntry,
} from "./shared"
import { organization, user } from "../auth"
import { bookings, sessionParticipantRoleEnum } from "./bookings"

/**
 * Delegated join authorization. A row with revoked_at set is a deny.
 * Daily JWTs cannot be revoked, so eject is a second phase.
 */
export const sessionParticipants = pgTable(
  "session_participants",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: sessionParticipantRoleEnum("role").notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    addedAt: timestamp("added_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
    }),
    ejectedAt: timestamp("ejected_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => ({
    bookingUserUidx: unique("session_participants_booking_user_uidx").on(
      t.bookingId,
      t.userId
    ),
    orgIdx: index("session_participants_org_idx").on(t.orgId),
    tenantPolicy: pgPolicy("session_participants_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
    participantReadPolicy: pgPolicy("session_participants_participant_read", {
      for: "select",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        OR user_id::text = current_setting('eleva.user_id', true)`,
    }),
  })
)

/**
 * Expert-only in-call note draft. Phase 10 migrates this into encrypted
 * records.kind = note. Not member-visible.
 */
export const sessionNoteDrafts = pgTable(
  "session_note_drafts",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    body: jsonb("body").$type<LocalizedRichTextEntry>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    bookingUidx: unique("session_note_drafts_booking_uidx").on(t.bookingId),
    tenantPolicy: pgPolicy("session_note_drafts_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

/**
 * Daily webhook idempotency. Staff-only, no tenant rows. 90-day retention.
 */
export const dailyWebhookEvents = pgTable(
  "daily_webhook_events",
  {
    eventId: varchar("event_id", { length: 255 }).primaryKey(),
    type: varchar("type", { length: 128 }).notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => ({
    typeIdx: index("daily_webhook_events_type_idx").on(t.type),
    receivedIdx: index("daily_webhook_events_received_idx").on(t.receivedAt),
    staffPolicy: pgPolicy("daily_webhook_events_staff_only", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type SessionParticipant = typeof sessionParticipants.$inferSelect
export type SessionNoteDraft = typeof sessionNoteDrafts.$inferSelect
export type DailyWebhookEvent = typeof dailyWebhookEvents.$inferSelect
