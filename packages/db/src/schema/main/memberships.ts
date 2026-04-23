import { sql } from "drizzle-orm"
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, pkColumn, updatedAt } from "./shared"
import { organizations } from "./organizations"
import { users } from "./users"

export const workosRoleEnum = pgEnum("workos_role", ["admin", "member"])
export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "suspended",
  "removed",
])

/**
 * Links a user to an organization with a WorkOS seniority role.
 * Eleva product label (patient / expert / clinic admin / operator) is
 * DERIVED from (org.type, membership.workos_role) + capability bundles
 * loaded from infra/workos/rbac-config.json. We do not store derived
 * labels in this table.
 *
 * RLS: org_id must match current_setting('eleva.org_id').
 */
export const memberships = pgTable(
  "memberships",
  {
    id: pkColumn(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workosRole: workosRoleEnum("workos_role").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    invitedAt: timestamp("invited_at", { withTimezone: true, mode: "date" }),
    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "date",
    }).default(sql`now()`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    // A user has at most one membership row per org.
    userOrgUnique: uniqueIndex("memberships_user_org_unique").on(
      t.userId,
      t.orgId
    ),
    orgIdx: index("memberships_org_idx").on(t.orgId),
    userIdx: index("memberships_user_idx").on(t.userId),
  })
)

export type Membership = typeof memberships.$inferSelect
export type NewMembership = typeof memberships.$inferInsert
export type WorkosRole = (typeof workosRoleEnum.enumValues)[number]
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number]
