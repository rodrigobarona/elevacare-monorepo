import { sql } from "drizzle-orm"
import {
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
  "solo_expert",
  "clinic",
  "eleva_operator",
])

/**
 * Organization = tenant boundary. Every tenant-scoped table carries
 * org_id referencing this table.
 *
 * Special orgs:
 * - type='personal' : auto-provisioned on first sign-in; patient product
 *   label lives here.
 * - type='solo_expert' : created on Become-Partner approval.
 * - type='clinic' : clinic signup; clinic admins hold workos_role='admin'.
 * - type='eleva_operator' : single internal org for Eleva staff, with
 *   cross-org capability bundles.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: pkColumn(),
    workosOrgId: varchar("workos_org_id", { length: 255 }).notNull(),
    type: orgTypeEnum("type").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    workosIdx: uniqueIndex("organizations_workos_org_id_idx").on(t.workosOrgId),
    tenantPolicy: pgPolicy("organizations_tenant_isolation", {
      using: sql`id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrgType = (typeof orgTypeEnum.enumValues)[number]
