import { sql } from "drizzle-orm"
import {
  integer,
  index,
  pgPolicy,
  pgTable,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn } from "./shared"
import { expertCategories } from "./expert-categories"
import { expertProfiles } from "./expert-profiles"

/**
 * Many-to-many join: which categories an expert lists themselves
 * under. Drives the marketplace category filter.
 *
 * RLS: tenant-scoped by org_id (mirrors expert_profiles.org_id).
 * Public reads project through expert_profiles -> denormalised
 * category slugs in the marketplace listing materialised view (S3).
 */
export const expertListings = pgTable(
  "expert_listings",
  {
    id: pkColumn(),
    orgId: orgIdColumn(),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expertCategories.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => ({
    expertCategoryUnique: uniqueIndex(
      "expert_listings_expert_category_unique"
    ).on(t.expertProfileId, t.categoryId),
    categoryIdx: index("expert_listings_category_idx").on(t.categoryId),
    expertIdx: index("expert_listings_expert_idx").on(t.expertProfileId),
    tenantPolicy: pgPolicy("expert_listings_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type ExpertListing = typeof expertListings.$inferSelect
export type NewExpertListing = typeof expertListings.$inferInsert
