import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import {
  createdAt,
  deletedAt,
  orgIdColumn,
  pkColumn,
  updatedAt,
} from "./shared"
import { organizations } from "./organizations"

/**
 * Public clinic profile. Shares the public username namespace with
 * `expert_profiles.username` — resolution at /[username] tries
 * experts first, then clinics (search-and-discovery-spec.md).
 *
 * One row per org of type='clinic'. The clinic admin manages it via
 * /org workspace surfaces in S6.
 *
 * RLS: tenant-scoped by org_id. Public reads happen via the same
 * pattern as expert_profiles — server action with
 * withPlatformAdminContext + status filter, projecting only
 * public-safe columns.
 */
export const clinicProfiles = pgTable(
  "clinic_profiles",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),

    slug: text("slug").notNull(),

    displayName: text("display_name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),

    /** ISO-3166-1 alpha-2 country code (clinic primary HQ). */
    countryCode: text("country_code"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    slugIdx: uniqueIndex("clinic_profiles_slug_idx").on(t.slug),
    orgIdx: index("clinic_profiles_org_idx").on(t.orgId),
    slugFormatChk: check(
      "clinic_profiles_slug_format",
      sql`slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' AND slug NOT LIKE '%--%'`
    ),
    tenantPolicy: pgPolicy("clinic_profiles_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type ClinicProfile = typeof clinicProfiles.$inferSelect
export type NewClinicProfile = typeof clinicProfiles.$inferInsert
