import { sql } from "drizzle-orm"
import {
  check,
  customType,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, pkColumn, updatedAt } from "./shared"
import { organization, user } from "../auth"
import { notificationChannelEnum } from "./member-privacy"

const citext = customType<{ data: string }>({
  dataType() {
    return "citext"
  },
})

const notificationKindChk = sql`
  kind IN (
    'invoice.blocked',
    'invoice.skipped',
    'invoice.pending',
    'booking.confirmed',
    'booking.reminder_24h',
    'booking.reminder_1h',
    'booking.cancelled',
    'booking.rescheduled',
    'payment.failed',
    'payment.receipt',
    'payout.paid',
    'payout.approval_required',
    'auth.magic_link',
    'auth.verify_email',
    'auth.reset_password',
    'auth.two_factor_otp',
    'auth.org_invitation'
  )
`

const notificationKindOrgScopeChk = sql`
  (
    kind IN (
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp'
    )
    AND org_id IS NULL
  )
  OR (
    kind NOT IN (
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp'
    )
    AND org_id IS NOT NULL
  )
`

/**
 * Lane 1 in-app inbox (Phase 08.3).
 *
 * RLS: owner SELECT/UPDATE (`user_id` plus `org_id` when present).
 * INSERT/DELETE are the notification worker (`platform_admin` or
 * `domain_events_publisher`). `org_id` is nullable for user-scoped
 * auth kinds. Does not store invoice numbers or PDF URLs.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: pkColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    userUnreadIdx: index("notifications_user_unread_idx")
      .on(t.userId, t.createdAt)
      .where(sql`read_at IS NULL`),
    orgIdx: index("notifications_org_idx").on(t.orgId),
    deliveryIdKey: uniqueIndex("notifications_delivery_id_key")
      .on(t.userId, sql`(data ->> 'deliveryId')`)
      .where(sql`(data ->> 'deliveryId') IS NOT NULL`),
    dataChk: check(
      "notifications_data_object",
      sql`jsonb_typeof(data) = 'object'`
    ),
    kindChk: check("notifications_kind", notificationKindChk),
    orgScopeChk: check(
      "notifications_kind_org_scope",
      notificationKindOrgScopeChk
    ),
    ownerRead: pgPolicy("notifications_owner_read", {
      for: "select",
      using: sql`user_id::text = current_setting('eleva.user_id', true) AND (org_id IS NULL OR org_id::text = current_setting('eleva.org_id', true))`,
    }),
    ownerUpdate: pgPolicy("notifications_owner_update", {
      for: "update",
      using: sql`user_id::text = current_setting('eleva.user_id', true) AND (org_id IS NULL OR org_id::text = current_setting('eleva.org_id', true))`,
      withCheck: sql`user_id::text = current_setting('eleva.user_id', true) AND (org_id IS NULL OR org_id::text = current_setting('eleva.org_id', true))`,
    }),
    workerInsert: pgPolicy("notifications_worker_insert", {
      for: "insert",
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
    workerDelete: pgPolicy("notifications_worker_delete", {
      for: "delete",
      using: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
  })
)

export const notificationDeliveryStatusEnum = pgEnum(
  "notification_delivery_status",
  [
    "queued",
    "sent",
    "delivered",
    "bounced",
    "complained",
    "failed",
    "suppressed",
  ]
)

/**
 * Per-channel delivery log. Claimed before the provider is called
 * (`lease_owner` + `claimed_at` written on INSERT). Guest e-mail mode
 * keys the row by `recipient_email`; user mode keys by `user_id`.
 * `org_id` is required for org-scoped kinds and null for user-scoped
 * auth deliveries. Writes are service-only; tenants may SELECT rows
 * for their org.
 */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: pkColumn(),
    orgId: uuid("org_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    recipientEmail: citext("recipient_email"),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationDeliveryStatusEnum("status")
      .notNull()
      .default("queued"),
    providerId: text("provider_id"),
    leaseOwner: text("lease_owner").notNull(),
    claimedAt: timestamp("claimed_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    firstAttemptAt: timestamp("first_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    smsBodyHash: text("sms_body_hash"),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    recipientChk: check(
      "notification_deliveries_recipient",
      sql`num_nonnulls(user_id, recipient_email) = 1 AND (recipient_email IS NULL OR channel = 'email')`
    ),
    kindChk: check("notification_deliveries_kind", notificationKindChk),
    orgScopeChk: check(
      "notification_deliveries_kind_org_scope",
      notificationKindOrgScopeChk
    ),
    idempotencyRecipientChannelKey: uniqueIndex(
      "notification_deliveries_idempotency_recipient_channel_key"
    ).on(
      t.idempotencyKey,
      sql`coalesce(user_id::text, lower(recipient_email::text))`,
      t.channel
    ),
    statusClaimedIdx: index("notification_deliveries_status_claimed_idx").on(
      t.status,
      t.claimedAt
    ),
    userIdx: index("notification_deliveries_user_idx").on(t.userId),
    orgIdx: index("notification_deliveries_org_idx").on(t.orgId),
    tenantRead: pgPolicy("notification_deliveries_tenant_read", {
      for: "select",
      using: sql`org_id IS NOT NULL AND org_id::text = current_setting('eleva.org_id', true)`,
    }),
    servicePolicy: pgPolicy("notification_deliveries_service_only", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
  })
)

export const emailSuppressionReasonEnum = pgEnum("email_suppression_reason", [
  "hard_bounce",
  "complaint",
])

/**
 * Hard-bounce / complaint suppression list. RLS class: service-only.
 */
export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    id: pkColumn(),
    email: citext("email").notNull(),
    reason: emailSuppressionReasonEnum("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    emailKey: unique("email_suppressions_email_key").on(t.email),
    servicePolicy: pgPolicy("email_suppressions_service_only", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
  })
)

/**
 * SMS opt-in OTP hashes. RLS class: service-only so members cannot
 * SELECT `code_hash`.
 */
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: pkColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
  },
  (t) => ({
    phoneChk: check(
      "phone_verifications_phone_e164",
      sql`phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'`
    ),
    userIdx: index("phone_verifications_user_idx").on(t.userId),
    expiresIdx: index("phone_verifications_expires_idx").on(t.expiresAt),
    servicePolicy: pgPolicy("phone_verifications_service_only", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true' OR current_setting('eleva.service', true) = 'domain_events_publisher'`,
    }),
  })
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect
export type NewNotificationDelivery = typeof notificationDeliveries.$inferInsert
export type EmailSuppression = typeof emailSuppressions.$inferSelect
export type NewEmailSuppression = typeof emailSuppressions.$inferInsert
export type PhoneVerification = typeof phoneVerifications.$inferSelect
export type NewPhoneVerification = typeof phoneVerifications.$inferInsert
export type NotificationDeliveryStatus =
  (typeof notificationDeliveryStatusEnum.enumValues)[number]
export type EmailSuppressionReason =
  (typeof emailSuppressionReasonEnum.enumValues)[number]
