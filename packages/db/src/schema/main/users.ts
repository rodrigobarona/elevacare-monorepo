import { boolean, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { createdAt, deletedAt, pkColumn, updatedAt } from "./shared"

/**
 * Canonical Eleva user identity. One WorkOS user -> one row.
 *
 * PII (email, display name) is NOT stored here — WorkOS is the SSOT
 * for identity data. The AuthKit session token provides PII at runtime.
 * For other-user PII lookups (admin panels, team lists), call the
 * WorkOS User Management API.
 *
 * NOT tenant-scoped: users live outside any single org because a single
 * human can hold memberships across multiple orgs (patient + expert).
 */
export const users = pgTable(
  "users",
  {
    id: pkColumn(),
    workosUserId: varchar("workos_user_id", { length: 255 }).notNull(),
    completedOnboarding: boolean("completed_onboarding")
      .notNull()
      .default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    workosIdx: uniqueIndex("users_workos_user_id_idx").on(t.workosUserId),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
