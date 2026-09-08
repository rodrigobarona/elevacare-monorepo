import { sql } from "drizzle-orm"
import {
  boolean,
  char,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
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
import { organization, user } from "../auth"
import { expertProfiles, sessionModeEnum } from "./expert-profiles"
import { eventTypes } from "./event-types"
import { expertPracticeLocations } from "./event-locations"
import { schedules } from "./schedules"

const citext = customType<{ data: string }>({
  dataType() {
    return "citext"
  },
})

export const countryScopeTypeEnum = pgEnum("country_scope_type", [
  "worldwide",
  "list",
])

export const publicHandleOwnerKindEnum = pgEnum("public_handle_owner_kind", [
  "expert",
  "clinic",
])

export const eventTypeModes = pgTable(
  "event_type_modes",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    eventTypeId: uuid("event_type_id").notNull(),
    mode: sessionModeEnum("mode").notNull(),
    locationId: uuid("location_id"),
    scheduleId: uuid("schedule_id").notNull(),
    priceCents: integer("price_cents"),
    currency: varchar("currency", { length: 3 }),
    durationMinutes: integer("duration_minutes"),
    countryScopeType: countryScopeTypeEnum("country_scope_type")
      .notNull()
      .default("list"),
    countryScopeCodes: text("country_scope_codes")
      .array()
      .notNull()
      .$defaultFn(() => []),
    languages: text("languages").array().notNull(),
    label: jsonb("label").$type<LocalizedText>(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("event_type_modes_org_idx").on(t.orgId),
    eventTypeIdx: index("event_type_modes_event_type_idx").on(t.eventTypeId),
    orgIdKey: uniqueIndex("event_type_modes_org_id_id_key").on(t.orgId, t.id),
    modeUnique: unique("event_type_modes_unique_idx")
      .on(t.eventTypeId, t.mode, t.locationId)
      .nullsNotDistinct(),
    languagesMinChk: check(
      "event_type_modes_languages_min",
      sql`cardinality(languages) >= 1`
    ),
    eventTypeFk: foreignKey({
      name: "event_type_modes_event_type_fk",
      columns: [t.orgId, t.eventTypeId],
      foreignColumns: [eventTypes.orgId, eventTypes.id],
    }).onDelete("cascade"),
    scheduleFk: foreignKey({
      name: "event_type_modes_schedule_fk",
      columns: [t.orgId, t.scheduleId],
      foreignColumns: [schedules.orgId, schedules.id],
    }).onDelete("restrict"),
    locationFk: foreignKey({
      name: "event_type_modes_location_fk",
      columns: [t.orgId, t.locationId],
      foreignColumns: [
        expertPracticeLocations.orgId,
        expertPracticeLocations.id,
      ],
    }).onDelete("restrict"),
    inPersonLocationChk: check(
      "event_type_modes_in_person_location",
      sql`(mode = 'in_person') = (location_id IS NOT NULL)`
    ),
    scopeChk: check(
      "event_type_modes_country_scope",
      sql`(country_scope_type = 'worldwide' AND cardinality(country_scope_codes) = 0) OR (country_scope_type = 'list' AND cardinality(country_scope_codes) >= 1)`
    ),
    currencyChk: check(
      "event_type_modes_currency_eur",
      sql`currency IS NULL OR currency = 'EUR'`
    ),
    priceChk: check(
      "event_type_modes_price_cents",
      sql`price_cents IS NULL OR price_cents >= 0`
    ),
    priceCurrencyChk: check(
      "event_type_modes_price_currency",
      sql`(price_cents IS NULL) = (currency IS NULL)`
    ),
    tenantPolicy: pgPolicy("event_type_modes_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export const bookingLinks = pgTable(
  "booking_links",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    eventTypeId: uuid("event_type_id").notNull(),
    eventTypeModeId: uuid("event_type_mode_id"),
    scheduleId: uuid("schedule_id"),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 320 }),
    priceCents: integer("price_cents"),
    note: text("note"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("booking_links_org_idx").on(t.orgId),
    tokenIdx: uniqueIndex("booking_links_token_hash_idx").on(t.tokenHash),
    maxUsesChk: check("booking_links_max_uses", sql`max_uses >= 1`),
    useCountChk: check(
      "booking_links_use_count",
      sql`use_count >= 0 AND use_count <= max_uses`
    ),
    eventTypeFk: foreignKey({
      name: "booking_links_event_type_fk",
      columns: [t.orgId, t.eventTypeId],
      foreignColumns: [eventTypes.orgId, eventTypes.id],
    }).onDelete("cascade"),
    // SQL 0025 uses ON DELETE SET NULL (event_type_mode_id) / (schedule_id)
    // only. Drizzle cannot express a column-specific SET NULL on a composite
    // FK, so the TS schema stays restrict and the migration is authoritative.
    modeFk: foreignKey({
      name: "booking_links_mode_fk",
      columns: [t.orgId, t.eventTypeModeId],
      foreignColumns: [eventTypeModes.orgId, eventTypeModes.id],
    }).onDelete("restrict"),
    scheduleFk: foreignKey({
      name: "booking_links_schedule_fk",
      columns: [t.orgId, t.scheduleId],
      foreignColumns: [schedules.orgId, schedules.id],
    }).onDelete("restrict"),
    tenantPolicy: pgPolicy("booking_links_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export const calendarFeedTokens = pgTable(
  "calendar_feed_tokens",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id").notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (t) => ({
    orgIdx: index("calendar_feed_tokens_org_idx").on(t.orgId),
    tokenIdx: uniqueIndex("calendar_feed_tokens_token_hash_idx").on(
      t.tokenHash
    ),
    expertFk: foreignKey({
      name: "calendar_feed_tokens_expert_fk",
      columns: [t.orgId, t.expertProfileId],
      foreignColumns: [expertProfiles.orgId, expertProfiles.id],
    }).onDelete("cascade"),
    tenantPolicy: pgPolicy("calendar_feed_tokens_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export const publicHandles = pgTable(
  "public_handles",
  {
    handle: citext("handle").primaryKey(),
    ownerKind: publicHandleOwnerKindEnum("owner_kind").notNull(),
    ownerId: uuid("owner_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    ownerIdx: uniqueIndex("public_handles_owner_idx").on(
      t.ownerKind,
      t.ownerId
    ),
    publicRead: pgPolicy("public_handles_public_read", {
      for: "select",
      using: sql`true`,
    }),
    adminWrite: pgPolicy("public_handles_admin_write", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type EventTypeMode = typeof eventTypeModes.$inferSelect
export type BookingLink = typeof bookingLinks.$inferSelect
export type CalendarFeedToken = typeof calendarFeedTokens.$inferSelect
export type PublicHandle = typeof publicHandles.$inferSelect
