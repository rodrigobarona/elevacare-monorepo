import { sql } from "drizzle-orm"
import {
  check,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, deletedAt, pkColumn, updatedAt } from "./shared"

export const orgTypeEnum = pgEnum("org_type", [
  "personal",
  "expert",
  "team",
  "staff",
])

/**
 * Organization = tenant boundary. Every tenant-scoped table carries
 * org_id referencing this table.
 *
 * PII (org display name) is NOT stored — WorkOS is the SSOT.
 * Fetch org names via the WorkOS Organizations API when needed for display.
 *
 * Special orgs:
 * - type='personal' : auto-provisioned on first sign-in; member product
 *   label lives here.
 * - type='expert' : created on Become-Partner approval (freelance expert).
 * - type='team' : team/clinic signup; team admins hold workos_role='admin'.
 * - type='staff' : single internal org for Eleva staff, with
 *   cross-org capability bundles.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: pkColumn(),
    workosOrgId: varchar("workos_org_id", { length: 255 }).notNull(),
    type: orgTypeEnum("type").notNull(),
    /** URL-safe slug used in org-scoped routes: /[slug]/dashboard */
    slug: text("slug"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    workosIdx: uniqueIndex("organizations_workos_org_id_idx").on(t.workosOrgId),
    slugIdx: uniqueIndex("organizations_slug_idx").on(t.slug),
    slugFormatChk: check(
      "organizations_slug_format",
      sql`slug IS NULL OR (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' AND slug NOT LIKE '%--%')`
    ),
    tenantPolicy: pgPolicy("organizations_tenant_isolation", {
      using: sql`id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrgType = (typeof orgTypeEnum.enumValues)[number]
