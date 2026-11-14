import { sql } from "drizzle-orm"
import {
  check,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import {
  partnerApplicationStatusEnum,
  type PartnerApplicationChecklist,
} from "./partner-applications"
import { organization, user } from "../auth"

/**
 * Clinic verification queue (Phase 11). A clinic files its legal name and
 * NIF; Eleva staff check them (Phase 12 queue UI). The clinic's public page,
 * its booking route and clinic attribution exist only while an `approved`
 * row exists — the same pattern as expert licences (`licenceVerified()`),
 * so a clinic can never mark itself verified on its own profile.
 *
 * The legal name and NIF live only here, never on `clinic_profiles`: the
 * latest approved row is the identity staff checked and the one SaaS
 * invoices use. A new identity means a new filing and a new review.
 *
 * Lifecycle reuses `partner_application_status`. An `approved` row needs a
 * reviewer, `reviewed_at` and every `CLINIC_CHECKLIST_ITEMS` check
 * (`@eleva/config/clinic-verification`) confirmed as JSON `true`.
 *
 * RLS: same policy shape as `become_partner_applications`
 * (`PARTNER_APPLICATION_TABLES`): the clinic may file a pending, unreviewed
 * row or refile an open one; decisions and deletes are staff-only.
 */
export const clinicVerifications = pgTable(
  "clinic_verifications",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    status: partnerApplicationStatusEnum("status").notNull().default("pending"),
    legalName: text("legal_name").notNull(),
    taxId: varchar("tax_id", { length: 32 }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    /** Staff reviewer. RESTRICT: an approval must keep who verified it. */
    reviewerUserId: uuid("reviewer_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    /** Staff reason shown to the clinic on `rejected` / `needs_changes`. */
    reason: text("reason"),
    checklist: jsonb("checklist")
      .$type<PartnerApplicationChecklist>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    openPerOrgUidx: uniqueIndex("clinic_verifications_open_uidx")
      .on(t.orgId)
      .where(sql`status IN ('pending', 'needs_changes')`),
    orgIdx: index("clinic_verifications_org_idx").on(t.orgId, t.submittedAt),
    queueIdx: index("clinic_verifications_queue_idx").on(
      t.status,
      t.submittedAt
    ),
    reasonChk: check(
      "clinic_verifications_reason",
      sql`status NOT IN ('rejected', 'needs_changes') OR (reason IS NOT NULL AND length(btrim(reason)) > 0)`
    ),
    approvedVerificationChk: check(
      "clinic_verifications_approved_verification",
      sql`status <> 'approved' OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND checklist @> '{"legal_entity_checked": true, "tax_id_checked": true}'::jsonb)`
    ),
    checklistShapeChk: check(
      "clinic_verifications_checklist_shape",
      sql`jsonb_typeof(checklist) = 'object'`
    ),
    readPolicy: pgPolicy("clinic_verifications_read", {
      for: "select",
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
    filePolicy: pgPolicy("clinic_verifications_expert_file", {
      for: "insert",
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) AND status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL`,
    }),
    refilePolicy: pgPolicy("clinic_verifications_expert_refile", {
      for: "update",
      using: sql`org_id::text = current_setting('eleva.org_id', true) AND status IN ('pending', 'needs_changes')`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) AND status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL`,
    }),
    staffPolicy: pgPolicy("clinic_verifications_staff_write", {
      using: sql`current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type ClinicVerification = typeof clinicVerifications.$inferSelect
export type NewClinicVerification = typeof clinicVerifications.$inferInsert
