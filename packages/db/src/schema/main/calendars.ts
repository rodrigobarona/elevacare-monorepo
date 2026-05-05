import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organizations } from "./organizations"
import { expertProfiles } from "./expert-profiles"

export const calendarProviderEnum = pgEnum("calendar_provider", [
  "google",
  "microsoft",
])

export const calendarConnectionStatusEnum = pgEnum(
  "calendar_connection_status",
  ["connecting", "connected", "disconnected", "error"]
)

/**
 * Account-level calendar connection. One row per Google/Microsoft
 * account OAuth grant. Tokens are stored in WorkOS Vault; the DB
 * holds an opaque VaultRef string.
 *
 * ADR-004: Eleva owns calendar OAuth (not WorkOS Pipes).
 */
export const connectedCalendars = pgTable(
  "connected_calendars",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),

    provider: calendarProviderEnum("provider").notNull(),
    accountEmail: text("account_email").notNull(),

    /** Opaque vault:namespace:objectId ref holding the OAuth credential. */
    credentialVaultRef: text("credential_vault_ref").notNull(),

    status: calendarConnectionStatusEnum("status")
      .notNull()
      .default("connecting"),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastSyncAt: timestamp("last_sync_at", {
      withTimezone: true,
      mode: "date",
    }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("connected_calendars_org_idx").on(t.orgId),
    expertIdx: index("connected_calendars_expert_idx").on(t.expertProfileId),
    expertProviderIdx: uniqueIndex(
      "connected_calendars_expert_provider_email_idx"
    ).on(t.expertProfileId, t.provider, t.accountEmail),
  })
)

/**
 * Sub-calendars selected as busy-time sources for conflict detection.
 * Each row is one calendar within a connected account that Eleva
 * checks when computing available slots.
 */
export const calendarBusySources = pgTable(
  "calendar_busy_sources",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    connectedCalendarId: uuid("connected_calendar_id")
      .notNull()
      .references(() => connectedCalendars.id, { onDelete: "cascade" }),

    /** Provider-specific calendar ID (e.g., Google calendarId). */
    externalCalendarId: text("external_calendar_id").notNull(),
    displayName: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),

    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("calendar_busy_sources_org_idx").on(t.orgId),
    connectedIdx: index("calendar_busy_sources_connected_idx").on(
      t.connectedCalendarId
    ),
    uniqueSourceIdx: uniqueIndex("calendar_busy_sources_unique_idx").on(
      t.connectedCalendarId,
      t.externalCalendarId
    ),
  })
)

/**
 * Destination calendar where Eleva writes confirmed session events.
 * One active destination per expert. Points to a specific sub-calendar
 * within a connected account.
 */
export const calendarDestinations = pgTable(
  "calendar_destinations",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),
    connectedCalendarId: uuid("connected_calendar_id")
      .notNull()
      .references(() => connectedCalendars.id, { onDelete: "cascade" }),

    externalCalendarId: text("external_calendar_id").notNull(),
    displayName: text("display_name").notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("calendar_destinations_org_idx").on(t.orgId),
    expertIdx: uniqueIndex("calendar_destinations_expert_idx").on(
      t.expertProfileId
    ),
  })
)

export type ConnectedCalendar = typeof connectedCalendars.$inferSelect
export type NewConnectedCalendar = typeof connectedCalendars.$inferInsert
export type CalendarBusySource = typeof calendarBusySources.$inferSelect
export type NewCalendarBusySource = typeof calendarBusySources.$inferInsert
export type CalendarDestination = typeof calendarDestinations.$inferSelect
export type NewCalendarDestination = typeof calendarDestinations.$inferInsert
export type CalendarProvider = (typeof calendarProviderEnum.enumValues)[number]
export type CalendarConnectionStatus =
  (typeof calendarConnectionStatusEnum.enumValues)[number]
