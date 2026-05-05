import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, deletedAt, pkColumn, updatedAt } from "./shared"
import { organizations } from "./organizations"
import { users } from "./users"

/**
 * Become-Partner application — the public form a prospective expert
 * submits with bio, fiscal info, license details, and supporting
 * documents (uploaded to Vercel Blob).
 *
 * Lifecycle:
 *   submitted    -> form posted; admin sees in queue
 *   under_review -> admin claimed for review
 *   approved     -> admin approved; provisioning creates expert_profiles
 *                   row + promotes WorkOS role + triggers onboarding
 *   rejected     -> admin rejected with reason; applicant can resubmit
 *
 * NOT tenant-scoped at submission time (the applicant has only a
 * personal org). On approval, the expert_profile created from this
 * row carries the new solo_expert org_id.
 *
 * Mutations restricted to:
 *   - applicant (themselves; INSERT/UPDATE-while-status='submitted')
 *   - admins with `experts:approve` / `experts:reject` capabilities
 */

export const becomePartnerStatusEnum = pgEnum("become_partner_status", [
  "submitted",
  "under_review",
  "approved",
  "rejected",
])

export const becomePartnerApplicantTypeEnum = pgEnum(
  "become_partner_applicant_type",
  ["solo_expert", "clinic_admin"]
)

/**
 * One uploaded document attached to a Become-Partner application.
 * Stored in `documents` JSONB column.
 */
export interface ApplicationDocument {
  /** Logical kind, e.g., 'license', 'id', 'cv', 'professional-insurance'. */
  kind: string
  /** Original file name as uploaded by applicant. */
  name: string
  /** Vercel Blob public URL. */
  url: string
  /**
   * Vercel Blob pathname (host-independent). Persisted alongside `url`
   * so admin tooling can re-fetch / delete the blob even if the public
   * URL host rotates.
   */
  pathname: string
  /** SHA-256 hash for integrity / dedupe. */
  hash?: string
  /** Bytes. */
  size: number
  /** MIME type. */
  contentType: string
  uploadedAt: string
}

export const becomePartnerApplications = pgTable(
  "become_partner_applications",
  {
    id: pkColumn(),

    /** WorkOS user that initiated the application. */
    applicantUserId: uuid("applicant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * Personal org of the applicant at submission time. The post-
     * approval solo-expert / clinic org is captured separately in
     * `provisioned_org_id` once the admin promotes the application.
     */
    applicantOrgId: uuid("applicant_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    type: becomePartnerApplicantTypeEnum("type").notNull(),

    /** Username/slug requested in the public namespace. Must validate. */
    usernameRequested: varchar("username_requested", { length: 30 }).notNull(),

    displayName: text("display_name").notNull(),
    bio: text("bio"),

    /** Fiscal info — NIF for PT, license info for healthcare experts. */
    nif: varchar("nif", { length: 32 }),
    licenseNumber: varchar("license_number", { length: 64 }),
    licenseScope: text("license_scope"),

    /** ISO-3166-1 alpha-2 codes. */
    practiceCountries: text("practice_countries")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** ISO-639-1 codes. */
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** Categories applicant requests to be listed under. */
    categorySlugs: text("category_slugs")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** Uploaded supporting documents. */
    documents: jsonb("documents")
      .$type<ApplicationDocument[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    status: becomePartnerStatusEnum("status").notNull().default("submitted"),

    /** Admin who claimed the application for review. */
    reviewerUserId: uuid("reviewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "date",
    }),

    /** Required when status='rejected'. */
    rejectionReason: text("rejection_reason"),

    /** Set on approval — the new solo-expert / clinic org id. */
    provisionedOrgId: uuid("provisioned_org_id").references(
      () => organizations.id,
      { onDelete: "set null" }
    ),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    applicantIdx: index("become_partner_applications_applicant_idx").on(
      t.applicantUserId
    ),
    statusIdx: index("become_partner_applications_status_idx").on(t.status),
    usernameIdx: index("become_partner_applications_username_idx").on(
      t.usernameRequested
    ),
    /**
     * One open application per applicant at a time. Approved/rejected
     * rows are kept for audit; only one row is allowed in a non-
     * terminal state. Enforced via a partial unique index.
     */
    onePendingPerApplicant: uniqueIndex(
      "become_partner_applications_one_pending"
    )
      .on(t.applicantUserId)
      .where(sql`status IN ('submitted', 'under_review')`),
  })
)

export type BecomePartnerApplication =
  typeof becomePartnerApplications.$inferSelect
export type NewBecomePartnerApplication =
  typeof becomePartnerApplications.$inferInsert
export type BecomePartnerStatus =
  (typeof becomePartnerStatusEnum.enumValues)[number]
export type BecomePartnerApplicantType =
  (typeof becomePartnerApplicantTypeEnum.enumValues)[number]
