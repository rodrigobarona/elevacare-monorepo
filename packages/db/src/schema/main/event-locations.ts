import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import {
  createdAt,
  orgIdColumn,
  pkColumn,
  updatedAt,
  type LocalizedText,
} from "./shared"
import { organizations } from "./organizations"
import { expertProfiles } from "./expert-profiles"
import { eventTypes } from "./event-types"

/**
 * Physical practice locations owned by an expert. Used as the source
 * list when creating in-person event types. An expert may have
 * multiple locations (e.g., two clinic offices).
 */
export const expertPracticeLocations = pgTable(
  "expert_practice_locations",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }),

    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    isPrimary: boolean("is_primary").notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("expert_practice_locations_org_idx").on(t.orgId),
    expertIdx: index("expert_practice_locations_expert_idx").on(
      t.expertProfileId
    ),
    primaryIdx: uniqueIndex("expert_practice_locations_primary_idx")
      .on(t.expertProfileId)
      .where(sql`is_primary = true`),
  })
)

/**
 * In-person meeting location attached to an event type. Localized
 * name and instructions displayed on the booking page and
 * confirmation email.
 */
export const eventLocations = pgTable(
  "event_locations",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),

    name: jsonb("name").$type<LocalizedText>().notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    instructions: jsonb("instructions").$type<LocalizedText>(),

    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("event_locations_org_idx").on(t.orgId),
    eventTypeIdx: index("event_locations_event_type_idx").on(t.eventTypeId),
  })
)

export type ExpertPracticeLocation = typeof expertPracticeLocations.$inferSelect
export type NewExpertPracticeLocation =
  typeof expertPracticeLocations.$inferInsert
export type EventLocation = typeof eventLocations.$inferSelect
export type NewEventLocation = typeof eventLocations.$inferInsert
