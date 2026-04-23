import { jsonb, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { createdAt, pkColumn, updatedAt } from "./shared"

/**
 * Eleva permission bundles. One row per bundle declared in
 * infra/workos/rbac-config.json. capability_bundle is a jsonb string
 * array of capability slugs (e.g. ["experts:approve","payouts:approve"]).
 *
 * Not tenant-scoped \u2014 the catalog is platform-wide and read by every
 * request when resolving "can this user perform X".
 */
export const roles = pgTable(
  "roles",
  {
    id: pkColumn(),
    slug: varchar("slug", { length: 64 }).notNull(),
    displayName: text("display_name").notNull(),
    capabilityBundle: jsonb("capability_bundle").$type<string[]>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugIdx: uniqueIndex("roles_slug_idx").on(t.slug),
  })
)

export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
