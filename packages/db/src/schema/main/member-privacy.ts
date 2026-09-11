import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, pkColumn, updatedAt } from "./shared"
import { user } from "../auth"

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "sms",
  "in_app",
])

export const notificationCategoryEnum = pgEnum("notification_category", [
  "booking",
  "reminder",
  "payment",
  "marketing",
  "system",
])

export const dsarRequestStatusEnum = pgEnum("dsar_request_status", [
  "pending",
  "processing",
  "ready",
  "expired",
  "failed",
])

export const accountDeletionRequestStatusEnum = pgEnum(
  "account_deletion_request_status",
  ["pending", "cancelled", "completed"]
)

const ownerUserVisible = {
  using: sql`user_id::text = current_setting('eleva.user_id', true)`,
  withCheck: sql`user_id::text = current_setting('eleva.user_id', true)`,
}

/**
 * Per-member notification matrix. RLS: owner-user-visible
 * (`user_id = eleva.user_id`). Consumed by Phase 8; written in Phase 5.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: pkColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    category: notificationCategoryEnum("category").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),
    timezone: varchar("timezone", { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    userIdx: index("notification_preferences_user_idx").on(t.userId),
    userChannelCategoryKey: unique(
      "notification_preferences_user_channel_category_key"
    ).on(t.userId, t.channel, t.category),
    quietHoursChk: check(
      "notification_preferences_quiet_hours",
      sql`(quiet_hours_start IS NULL) = (quiet_hours_end IS NULL)`
    ),
    ownerPolicy: pgPolicy(
      "notification_preferences_owner_user_visible",
      ownerUserVisible
    ),
  })
)

/**
 * Member DSAR export requests. RLS: owner-user-visible.
 * Zip lives on the private Blob store; signed URL is 24h.
 */
export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: pkColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: dsarRequestStatusEnum("status").notNull().default("pending"),
    blobPathname: text("blob_pathname"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => ({
    userIdx: index("dsar_requests_user_idx").on(t.userId),
    statusIdx: index("dsar_requests_status_idx").on(t.status),
    ownerPolicy: pgPolicy("dsar_requests_owner_user_visible", ownerUserVisible),
  })
)

/**
 * Member account-deletion requests. RLS: owner-user-visible.
 * `scheduled_for` uses ACCOUNT_DELETION_GRACE_DAYS (14) as product grace.
 */
export const accountDeletionRequests = pgTable(
  "account_deletion_requests",
  {
    id: pkColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    status: accountDeletionRequestStatusEnum("status")
      .notNull()
      .default("pending"),
  },
  (t) => ({
    userIdx: index("account_deletion_requests_user_idx").on(t.userId),
    pendingUserIdx: uniqueIndex("account_deletion_requests_pending_user_idx")
      .on(t.userId)
      .where(sql`status = 'pending'`),
    scheduledIdx: index("account_deletion_requests_scheduled_idx")
      .on(t.scheduledFor)
      .where(sql`status = 'pending'`),
    ownerPolicy: pgPolicy(
      "account_deletion_requests_owner_user_visible",
      ownerUserVisible
    ),
  })
)

export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert
export type DsarRequest = typeof dsarRequests.$inferSelect
export type NewDsarRequest = typeof dsarRequests.$inferInsert
export type AccountDeletionRequest = typeof accountDeletionRequests.$inferSelect
export type NewAccountDeletionRequest =
  typeof accountDeletionRequests.$inferInsert
