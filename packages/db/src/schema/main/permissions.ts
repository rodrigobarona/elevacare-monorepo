import { pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { createdAt, pkColumn } from "./shared"

/**
 * Individual capability catalog. Each row is one capability slug such as
 * 'experts:approve' or 'payouts:approve'. Rows are seeded from
 * infra/workos/rbac-config.json by `pnpm rbac:generate`.
 *
 * The effective capabilities a request carries are the union of the
 * bundles attached to its memberships' roles (resolved in @eleva/auth).
 */
export const permissions = pgTable(
  "permissions",
  {
    id: pkColumn(),
    slug: varchar("slug", { length: 64 }).notNull(),
    displayName: text("display_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    slugIdx: uniqueIndex("permissions_slug_idx").on(t.slug),
  })
)

export type Permission = typeof permissions.$inferSelect
export type NewPermission = typeof permissions.$inferInsert
