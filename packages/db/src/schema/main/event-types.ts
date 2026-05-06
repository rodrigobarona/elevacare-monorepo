import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import {
  createdAt,
  deletedAt,
  orgIdColumn,
  pkColumn,
  updatedAt,
  type LocalizedText,
} from "./shared"
import { organizations } from "./organizations"
import { expertProfiles, sessionModeEnum } from "./expert-profiles"
import { schedules } from "./schedules"

/**
 * Bookable service definition. Each expert publishes one or more event
 * types (e.g., "First Consultation 60 min", "Coaching Call 30 min").
 *
 * Public booking URL: eleva.care/[username]/[slug]
 * Slug is case-insensitive unique per expert.
 *
 * Localized fields (title, description) are JSONB with shape
 * { en: string, pt?: string, es?: string }.
 */
export const eventTypes = pgTable(
  "event_types",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id").references(() => schedules.id, {
      onDelete: "set null",
    }),

    slug: varchar("slug", { length: 50 }).notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>(),

    durationMinutes: integer("duration_minutes").notNull().default(60),
    priceAmount: integer("price_amount").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),

    /** ISO-639-1 codes this event type supports. */
    languages: text("languages")
      .array()
      .notNull()
      .$defaultFn(() => []),
    sessionMode: sessionModeEnum("session_mode").notNull().default("online"),

    bookingWindowDays: integer("booking_window_days"),
    minimumNoticeMinutes: integer("minimum_notice_minutes")
      .notNull()
      .default(60),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    cancellationWindowHours: integer("cancellation_window_hours"),
    rescheduleWindowHours: integer("reschedule_window_hours"),

    requiresApproval: boolean("requires_approval").notNull().default(false),
    worldwideMode: boolean("worldwide_mode").notNull().default(false),
    active: boolean("active").notNull().default(true),
    published: boolean("published").notNull().default(false),
    position: integer("position").notNull().default(0),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    expertSlugIdx: uniqueIndex("event_types_expert_slug_idx")
      .on(t.expertProfileId, t.slug)
      .where(sql`deleted_at IS NULL`),
    orgIdx: index("event_types_org_idx").on(t.orgId),
    expertIdx: index("event_types_expert_idx").on(t.expertProfileId),
    publishedIdx: index("event_types_published_idx").on(t.published, t.active),
    slugFormatChk: check(
      "event_types_slug_format",
      sql`slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$' AND slug NOT LIKE '%--%'`
    ),
    durationChk: check(
      "event_types_duration_positive",
      sql`duration_minutes > 0`
    ),
    priceChk: check("event_types_price_non_negative", sql`price_amount >= 0`),
    currencyChk: check(
      "event_types_currency_iso",
      sql`currency = upper(currency) AND length(currency) = 3`
    ),
    windowsChk: check(
      "event_types_windows_non_negative",
      sql`(booking_window_days IS NULL OR booking_window_days >= 0) AND minimum_notice_minutes >= 0 AND buffer_before_minutes >= 0 AND buffer_after_minutes >= 0 AND (cancellation_window_hours IS NULL OR cancellation_window_hours >= 0) AND (reschedule_window_hours IS NULL OR reschedule_window_hours >= 0) AND position >= 0`
    ),
    tenantPolicy: pgPolicy("event_types_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type EventType = typeof eventTypes.$inferSelect
export type NewEventType = typeof eventTypes.$inferInsert
