import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
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
} from "./shared"
import { organizations } from "./organizations"
import { users } from "./users"

/**
 * Expert public profile.
 *
 * One row per active solo-expert (org.type='solo_expert') and one row
 * per clinic-member-acting-as-expert (clinic experts share their
 * clinic's org_id and inherit the clinic's billing). The username
 * column shares a public namespace with `clinic_profiles.slug` —
 * resolution at /[username] tries experts first, then clinics
 * (search-and-discovery-spec.md).
 *
 * RLS: tenant-scoped by org_id. Public reads happen via a server
 * action that resolves the username, fetches the row WITHOUT RLS
 * (using `withPlatformAdminContext` + an explicit `status='active'`
 * filter), and projects only public-safe columns to the marketplace.
 *
 * Lifecycle states (see ADR-013 + identity-rbac-spec.md):
 *   draft         -> Become-Partner application submitted, not approved yet
 *   approved      -> admin approved; expert may begin Connect onboarding
 *   active        -> Connect + Identity + invoicing all green; appears
 *                    in marketplace
 *   suspended     -> admin pause (e.g., compliance issue)
 */

export const expertStatusEnum = pgEnum("expert_status", [
  "draft",
  "approved",
  "active",
  "suspended",
])

export const stripeIdentityStatusEnum = pgEnum("stripe_identity_status", [
  "not_started",
  "requires_input",
  "processing",
  "verified",
  "canceled",
])

export const invoicingProviderEnum = pgEnum("invoicing_provider", [
  "toconline",
  "moloni",
  "manual",
])

export const invoicingSetupStatusEnum = pgEnum("invoicing_setup_status", [
  "not_started",
  "connecting",
  "connected",
  "manual_acknowledged",
  "expired",
])

export const sessionModeEnum = pgEnum("session_mode", [
  "online",
  "in_person",
  "phone",
])

export const expertProfiles = pgTable(
  "expert_profiles",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * Public username (lowercase [a-z0-9-], 3–30 chars). Shared
     * namespace with clinic_profiles.slug. CHECK constraint enforces
     * format; reserved-name rejection happens at the application
     * layer (validateUsername) AND at admin Become-Partner approval.
     */
    username: varchar("username", { length: 30 }).notNull(),

    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),

    /** ISO-639-1 codes (e.g., 'pt', 'en', 'es'). */
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** ISO-3166-1 alpha-2 codes (e.g., 'PT', 'ES', 'BR'). */
    practiceCountries: text("practice_countries")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** Free-form license scope (e.g., "OPP 12345"). Validated by admin. */
    licenseScope: text("license_scope"),

    /**
     * Worldwide-mode flag: bypasses country-license validation for
     * non-clinical sessions (coaching, mentoring). See
     * scheduling-booking-spec.md.
     */
    worldwideMode: boolean("worldwide_mode").notNull().default(false),

    /** PT NIF or other tax ID. Stored encrypted via withVault in S5. */
    nif: varchar("nif", { length: 32 }),

    /** Default session modes offered (event-types extend this in S3). */
    sessionModes: sessionModeEnum("session_modes")
      .array()
      .notNull()
      .default(sql`ARRAY['online']::session_mode[]`),

    /** Stripe Connect Express account ID. Set after createConnectAccount. */
    stripeAccountId: varchar("stripe_account_id", { length: 255 }),

    /** Stripe Identity verification session status. */
    stripeIdentityStatus: stripeIdentityStatusEnum("stripe_identity_status")
      .notNull()
      .default("not_started"),

    /** Tier 2 invoicing provider (TOConline / Moloni / Manual). */
    invoicingProvider: invoicingProviderEnum("invoicing_provider"),
    invoicingSetupStatus: invoicingSetupStatusEnum("invoicing_setup_status")
      .notNull()
      .default("not_started"),

    /**
     * Whether this expert is opted into the Top Expert subscription
     * (8% platform fee instead of 15%). Source of truth is Stripe
     * subscription on Eleva platform; this column mirrors the active
     * state for fast reads.
     */
    topExpertActive: boolean("top_expert_active").notNull().default(false),

    /** Free-form metadata for marketing surfaces. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    status: expertStatusEnum("status").notNull().default("draft"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("expert_profiles_username_idx").on(t.username),
    orgIdx: index("expert_profiles_org_idx").on(t.orgId),
    userIdx: index("expert_profiles_user_idx").on(t.userId),
    statusIdx: index("expert_profiles_status_idx").on(t.status),
    usernameFormatChk: check(
      "expert_profiles_username_format",
      sql`username ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' AND username NOT LIKE '%--%'`
    ),
  })
)

export type ExpertProfile = typeof expertProfiles.$inferSelect
export type NewExpertProfile = typeof expertProfiles.$inferInsert
export type ExpertStatus = (typeof expertStatusEnum.enumValues)[number]
export type StripeIdentityStatus =
  (typeof stripeIdentityStatusEnum.enumValues)[number]
export type InvoicingProvider =
  (typeof invoicingProviderEnum.enumValues)[number]
export type InvoicingSetupStatus =
  (typeof invoicingSetupStatusEnum.enumValues)[number]
export type SessionMode = (typeof sessionModeEnum.enumValues)[number]
