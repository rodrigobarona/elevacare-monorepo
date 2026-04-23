import { pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { createdAt, deletedAt, pkColumn, updatedAt } from "./shared"

/**
 * Canonical Eleva user identity. One WorkOS user -> one row. Identity
 * profile data beyond email/display-name lives in the per-org profile
 * tables (expert_profiles, clinic_profiles, patient_profiles) that land
 * in S2.
 *
 * NOT tenant-scoped: users live outside any single org because a single
 * human can hold memberships across multiple orgs (patient + expert).
 * All mutations still go through withAudit, but no RLS policy applies.
 */
export const users = pgTable(
  "users",
  {
    id: pkColumn(),
    workosUserId: varchar("workos_user_id", { length: 255 }).notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    workosIdx: uniqueIndex("users_workos_user_id_idx").on(t.workosUserId),
    emailIdx: uniqueIndex("users_email_lower_idx").on(t.email),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
