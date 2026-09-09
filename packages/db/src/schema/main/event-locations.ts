import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
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
  orgIdColumn,
  pkColumn,
  updatedAt,
  type LocalizedText,
} from "./shared"
import { organization } from "../auth"
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
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id").notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    line2: varchar("line2", { length: 200 }),
    city: varchar("city", { length: 100 }).notNull(),
    region: varchar("region", { length: 100 }),
    country: varchar("country", { length: 2 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    timezone: varchar("timezone", { length: 64 }),
    instructions: jsonb("instructions").$type<LocalizedText>(),
    active: boolean("active").notNull().default(true),

    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    isPrimary: boolean("is_primary").notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("expert_practice_locations_org_idx").on(t.orgId),
    orgIdKey: uniqueIndex("expert_practice_locations_org_id_id_key").on(
      t.orgId,
      t.id
    ),
    expertIdx: index("expert_practice_locations_expert_idx").on(
      t.expertProfileId
    ),
    primaryIdx: uniqueIndex("expert_practice_locations_primary_idx")
      .on(t.expertProfileId)
      .where(sql`is_primary = true`),
    expertFk: foreignKey({
      name: "practice_loc_expert_fk",
      columns: [t.expertProfileId],
      foreignColumns: [expertProfiles.id],
    }).onDelete("cascade"),
    tenantPolicy: pgPolicy("expert_practice_locations_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
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
    orgId: orgIdColumn().references(() => organization.id, {
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
    tenantPolicy: pgPolicy("event_locations_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type ExpertPracticeLocation = typeof expertPracticeLocations.$inferSelect
export type NewExpertPracticeLocation =
  typeof expertPracticeLocations.$inferInsert
export type EventLocation = typeof eventLocations.$inferSelect
export type NewEventLocation = typeof eventLocations.$inferInsert
