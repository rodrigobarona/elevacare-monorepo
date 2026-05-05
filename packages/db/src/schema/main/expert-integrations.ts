import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
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

export const integrationCategoryEnum = pgEnum("integration_category", [
  "calendar",
  "invoicing",
  "crm",
  "video",
  "other",
])

export const integrationConnectTypeEnum = pgEnum("integration_connect_type", [
  "pipes",
  "oauth",
  "api_key",
  "manual",
])

export const integrationStatusEnum = pgEnum("integration_status", [
  "connecting",
  "connected",
  "disconnected",
  "error",
  "expired",
])

/**
 * Unified expert integration row. One row per connected provider
 * (Google Calendar, TOConline, Manual invoicing, etc.).
 *
 * Replaces `connected_calendars` and `expert_integration_credentials`.
 *
 * Credential strategy is declared by `connectType`:
 *   pipes  -> WorkOS Pipes manages OAuth (workosUserId required)
 *   oauth  -> Eleva-managed OAuth via WorkOS Vault (vaultRef required)
 *   api_key -> expert-supplied key in Vault (vaultRef required)
 *   manual -> no credentials
 *
 * CHECK constraints enforce the above invariants at the DB level.
 *
 * RLS: tenant-scoped by org_id (see ADR-003).
 */
export const expertIntegrations = pgTable(
  "expert_integrations",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),

    category: integrationCategoryEnum("category").notNull(),
    /** Globally unique slug: "google-calendar", "toconline", etc. */
    slug: text("slug").notNull(),
    connectType: integrationConnectTypeEnum("connect_type").notNull(),

    /** WorkOS user ID for Pipes getAccessToken calls (calendar integrations). */
    workosUserId: text("workos_user_id"),

    /** WorkOS Vault reference for Eleva-managed OAuth tokens (invoicing). */
    vaultRef: varchar("vault_ref", { length: 255 }),

    /** Human-readable account label: email, account name, etc. */
    accountIdentifier: text("account_identifier"),

    /** Adapter-specific metadata (series prefix, company ID, etc.). Never tokens. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    status: integrationStatusEnum("status").notNull().default("connecting"),

    connectedAt: timestamp("connected_at", {
      withTimezone: true,
      mode: "date",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    lastSyncAt: timestamp("last_sync_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastRefreshAt: timestamp("last_refresh_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastErrorCode: varchar("last_error_code", { length: 64 }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    orgIdx: index("expert_integrations_org_idx").on(t.orgId),
    expertIdx: index("expert_integrations_expert_idx").on(t.expertProfileId),
    categoryIdx: index("expert_integrations_category_idx").on(t.category),
    expertSlugUnique: uniqueIndex("expert_integrations_expert_slug_idx").on(
      t.expertProfileId,
      t.slug
    ),
    statusIdx: index("expert_integrations_status_idx").on(t.status),
    pipesCheck: check(
      "expert_integrations_pipes_check",
      sql`connect_type != 'pipes' OR workos_user_id IS NOT NULL`
    ),
    oauthCheck: check(
      "expert_integrations_oauth_check",
      sql`connect_type != 'oauth' OR vault_ref IS NOT NULL`
    ),
    tenantPolicy: pgPolicy("expert_integrations_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
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
    expertIntegrationId: uuid("expert_integration_id")
      .notNull()
      .references(() => expertIntegrations.id, { onDelete: "cascade" }),

    /** Provider-specific calendar ID (e.g., Google calendarId). */
    externalCalendarId: text("external_calendar_id").notNull(),
    displayName: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),

    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("calendar_busy_sources_org_idx").on(t.orgId),
    integrationIdx: index("calendar_busy_sources_integration_idx").on(
      t.expertIntegrationId
    ),
    uniqueSourceIdx: uniqueIndex("calendar_busy_sources_unique_idx").on(
      t.expertIntegrationId,
      t.externalCalendarId
    ),
    tenantPolicy: pgPolicy("calendar_busy_sources_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
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
    expertIntegrationId: uuid("expert_integration_id")
      .notNull()
      .references(() => expertIntegrations.id, { onDelete: "cascade" }),

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
    tenantPolicy: pgPolicy("calendar_destinations_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type ExpertIntegration = typeof expertIntegrations.$inferSelect
export type NewExpertIntegration = typeof expertIntegrations.$inferInsert
export type CalendarBusySource = typeof calendarBusySources.$inferSelect
export type NewCalendarBusySource = typeof calendarBusySources.$inferInsert
export type CalendarDestination = typeof calendarDestinations.$inferSelect
export type NewCalendarDestination = typeof calendarDestinations.$inferInsert
export type IntegrationCategory =
  (typeof integrationCategoryEnum.enumValues)[number]
export type IntegrationConnectType =
  (typeof integrationConnectTypeEnum.enumValues)[number]
export type IntegrationStatus =
  (typeof integrationStatusEnum.enumValues)[number]
