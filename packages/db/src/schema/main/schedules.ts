import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  time,
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
} from "./shared"
import { organizations } from "./organizations"
import { expertProfiles } from "./expert-profiles"

/**
 * Expert availability schedule. Each expert has one default schedule
 * and may create additional named schedules for different contexts.
 * Event types can reference a specific schedule; if null they use the
 * expert's default.
 *
 * Times in availability_rules and date_overrides are interpreted in
 * the schedule's timezone.
 */
export const schedules = pgTable(
  "schedules",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 100 }).notNull(),

    /** IANA timezone (e.g., "Europe/Lisbon"). */
    timezone: varchar("timezone", { length: 64 }).notNull(),

    isDefault: boolean("is_default").notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    orgIdx: index("schedules_org_idx").on(t.orgId),
    expertIdx: index("schedules_expert_idx").on(t.expertProfileId),
    defaultIdx: uniqueIndex("schedules_expert_default_idx")
      .on(t.expertProfileId, t.isDefault)
      .where(sql`is_default = true AND deleted_at IS NULL`),
  })
)

/**
 * Recurring weekly time windows within a schedule.
 * dayOfWeek: 0 = Sunday, 6 = Saturday (ISO weekday convention).
 * start/end are wall-clock times in the parent schedule's timezone.
 */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),

    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),

    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("availability_rules_org_idx").on(t.orgId),
    scheduleIdx: index("availability_rules_schedule_idx").on(t.scheduleId),
    dayChk: check(
      "availability_rules_day_range",
      sql`day_of_week >= 0 AND day_of_week <= 6`
    ),
    timeChk: check("availability_rules_time_order", sql`start_time < end_time`),
  })
)

/**
 * Per-date overrides to the normal weekly availability. When
 * is_blocked = true the entire day is blocked (start/end ignored).
 * Otherwise start/end replace the normal availability window.
 */
export const dateOverrides = pgTable(
  "date_overrides",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),

    overrideDate: text("override_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    isBlocked: boolean("is_blocked").notNull().default(false),

    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("date_overrides_org_idx").on(t.orgId),
    scheduleIdx: index("date_overrides_schedule_idx").on(t.scheduleId),
    dateIdx: uniqueIndex("date_overrides_schedule_date_idx").on(
      t.scheduleId,
      t.overrideDate
    ),
    blockedChk: check(
      "date_overrides_blocked_nulls",
      sql`(is_blocked = true AND start_time IS NULL AND end_time IS NULL) OR (is_blocked = false AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)`
    ),
  })
)

export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type AvailabilityRule = typeof availabilityRules.$inferSelect
export type NewAvailabilityRule = typeof availabilityRules.$inferInsert
export type DateOverride = typeof dateOverrides.$inferSelect
export type NewDateOverride = typeof dateOverrides.$inferInsert
