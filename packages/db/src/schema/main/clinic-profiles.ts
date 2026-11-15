import { sql } from "drizzle-orm"
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import {
  createdAt,
  deletedAt,
  orgIdColumn,
  pkColumn,
  updatedAt,
} from "./shared"
import { organization } from "../auth"

export const CLINIC_PAYOUT_MODES = ["expert", "clinic"] as const
export type ClinicPayoutMode = (typeof CLINIC_PAYOUT_MODES)[number]

/**
 * Where a clinic booking's payout goes: the expert's own Connect account
 * (default, v1) or the clinic's. Resolved once at payment confirmation into
 * the payout snapshot, so changing it never redirects money already owed.
 */
export const clinicPayoutModeEnum = pgEnum(
  "clinic_payout_mode",
  CLINIC_PAYOUT_MODES
)

/** Billing address for the clinic's SaaS invoices. */
export type ClinicBillingAddress = {
  line1?: string
  line2?: string
  postalCode?: string
  city?: string
  /** ISO-3166-1 alpha-2. */
  country?: string
}

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
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),

    slug: text("slug").notNull(),

    displayName: text("display_name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),

    /** ISO-3166-1 alpha-2 country code (clinic primary HQ). */
    countryCode: text("country_code"),

    // The legal name and NIF live only on `clinic_verifications`: the
    // approved row is the identity Eleva checked and invoices, so editing
    // the profile can never change who was verified.
    billingAddress: jsonb("billing_address")
      .$type<ClinicBillingAddress>()
      .notNull()
      .default({}),
    /** Areas of care, `@eleva/config` expert-category slugs. */
    specialties: text("specialties").array().notNull().default([]),
    payoutMode: clinicPayoutModeEnum("payout_mode").notNull().default("expert"),

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
    billingAddressShapeChk: check(
      "clinic_profiles_billing_address_shape",
      sql`jsonb_typeof(billing_address) = 'object'`
    ),
    tenantPolicy: pgPolicy("clinic_profiles_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type ClinicProfile = typeof clinicProfiles.$inferSelect
export type NewClinicProfile = typeof clinicProfiles.$inferInsert
