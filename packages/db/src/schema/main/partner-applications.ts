import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { expertProfiles } from "./expert-profiles"
import { organization, user } from "../auth"

export const PARTNER_APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "needs_changes",
] as const

export type PartnerApplicationStatus =
  (typeof PARTNER_APPLICATION_STATUSES)[number]

/** Statuses that still wait on the expert or on staff. One per profile. */
export const OPEN_PARTNER_APPLICATION_STATUSES = [
  "pending",
  "needs_changes",
] as const satisfies readonly PartnerApplicationStatus[]

export const partnerApplicationStatusEnum = pgEnum(
  "partner_application_status",
  PARTNER_APPLICATION_STATUSES
)

/**
 * Staff review checklist keyed by `LICENCE_CHECKLIST_ITEMS`
 * (`@eleva/config/professional-bodies`); `true` once confirmed.
 */
export type PartnerApplicationChecklist = Record<string, boolean>

/**
 * Licence verification application (decision log 2026-10-29 "Launch legal
 * posture"). Setup completion files a `pending` row with the licence the
 * expert declared; the profile stays `approved` (not public) until staff
 * approve it. Licence fields are a snapshot of what was submitted, so staff
 * review exactly what the expert sent even if the profile changes later.
 *
 * An `approved` row is the licence verification record: licence snapshot,
 * reviewer, `reviewed_at` and every `LICENCE_CHECKLIST_ITEMS` check
 * confirmed as JSON `true` (DB CHECK).
 *
 * RLS: tenant-owned reads plus the `eleva.platform_admin` bypass for the
 * staff queue. The expert org may only file a pending, unreviewed row or
 * refile an open one; decisions and deletes are staff-only, so an approved
 * row cannot be rewritten (`PARTNER_APPLICATION_TABLES` in rls/policies).
 */
export const becomePartnerApplications = pgTable(
  "become_partner_applications",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    expertProfileId: uuid("expert_profile_id").notNull(),
    status: partnerApplicationStatusEnum("status").notNull().default("pending"),
    /** `@eleva/config/professional-bodies` id. */
    professionalBody: text("professional_body").notNull(),
    licenceNumber: varchar("licence_number", { length: 64 }).notNull(),
    ersRegistrationNumber: varchar("ers_registration_number", {
      length: 32,
    }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    /** Staff reviewer. RESTRICT: an approval must keep who verified it. */
    reviewerUserId: uuid("reviewer_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    /** Staff reason shown to the expert on `rejected` / `needs_changes`. */
    reason: text("reason"),
    checklist: jsonb("checklist")
      .$type<PartnerApplicationChecklist>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    profileFk: foreignKey({
      name: "become_partner_applications_profile_fk",
      columns: [t.orgId, t.expertProfileId],
      foreignColumns: [expertProfiles.orgId, expertProfiles.id],
    }).onDelete("cascade"),
    openPerProfileUidx: uniqueIndex("become_partner_applications_open_uidx")
      .on(t.expertProfileId)
      .where(sql`status IN ('pending', 'needs_changes')`),
    profileIdx: index("become_partner_applications_profile_idx").on(
      t.expertProfileId,
      t.submittedAt
    ),
    queueIdx: index("become_partner_applications_queue_idx").on(
      t.status,
      t.submittedAt
    ),
    reasonChk: check(
      "become_partner_applications_reason",
      sql`status NOT IN ('rejected', 'needs_changes') OR (reason IS NOT NULL AND length(btrim(reason)) > 0)`
    ),
    approvedVerificationChk: check(
      "become_partner_applications_approved_verification",
      sql`status <> 'approved' OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND checklist @> '{"register_checked": true, "name_matches": true, "ers_checked": true}'::jsonb)`
    ),
    checklistShapeChk: check(
      "become_partner_applications_checklist_shape",
      sql`jsonb_typeof(checklist) = 'object'`
    ),
    readPolicy: pgPolicy("become_partner_applications_read", {
      for: "select",
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
    expertFilePolicy: pgPolicy("become_partner_applications_expert_file", {
      for: "insert",
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) AND status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL`,
    }),
    expertRefilePolicy: pgPolicy("become_partner_applications_expert_refile", {
      for: "update",
      using: sql`org_id::text = current_setting('eleva.org_id', true) AND status IN ('pending', 'needs_changes')`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) AND status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL`,
    }),
    staffWritePolicy: pgPolicy("become_partner_applications_staff_write", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type BecomePartnerApplication =
  typeof becomePartnerApplications.$inferSelect
export type NewBecomePartnerApplication =
  typeof becomePartnerApplications.$inferInsert
