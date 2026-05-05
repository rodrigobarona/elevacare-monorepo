import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"

import { withPlatformAdminContext, type Tx } from "../context"
import * as main from "../schema/main"
import type { BecomePartnerStatus } from "../schema/main/become-partner-applications"

export interface AdminApplicationRow {
  id: string
  applicantUserId: string
  applicantEmail: string | null
  applicantDisplayName: string | null
  type: main.BecomePartnerApplicantType
  usernameRequested: string
  displayName: string
  bio: string | null
  nif: string | null
  licenseNumber: string | null
  licenseScope: string | null
  practiceCountries: string[]
  languages: string[]
  categorySlugs: string[]
  documents: main.ApplicationDocument[]
  status: BecomePartnerStatus
  reviewerUserId: string | null
  reviewedAt: Date | null
  rejectionReason: string | null
  provisionedOrgId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ListApplicationsFilters {
  status?: BecomePartnerStatus | BecomePartnerStatus[]
  limit?: number
  offset?: number
}

export interface ListApplicationsResult {
  rows: AdminApplicationRow[]
  total: number
}

function mapRow(
  app: main.BecomePartnerApplication,
  user: main.User | null
): AdminApplicationRow {
  return {
    id: app.id,
    applicantUserId: app.applicantUserId,
    applicantEmail: user?.email ?? null,
    applicantDisplayName: user?.displayName ?? null,
    type: app.type,
    usernameRequested: app.usernameRequested,
    displayName: app.displayName,
    bio: app.bio,
    nif: app.nif,
    licenseNumber: app.licenseNumber,
    licenseScope: app.licenseScope,
    practiceCountries: app.practiceCountries,
    languages: app.languages,
    categorySlugs: app.categorySlugs,
    documents: app.documents ?? [],
    status: app.status,
    reviewerUserId: app.reviewerUserId,
    reviewedAt: app.reviewedAt,
    rejectionReason: app.rejectionReason,
    provisionedOrgId: app.provisionedOrgId,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  }
}

export async function listApplications(
  filters: ListApplicationsFilters = {}
): Promise<ListApplicationsResult> {
  return withPlatformAdminContext(async (tx) => {
    const { status, limit = 25, offset = 0 } = filters

    const conditions = [isNull(main.becomePartnerApplications.deletedAt)]

    if (status) {
      const statuses = Array.isArray(status) ? status : [status]
      conditions.push(inArray(main.becomePartnerApplications.status, statuses))
    }

    const where = and(...conditions)

    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(main.becomePartnerApplications)
      .where(where)

    const total = countRows[0]?.count ?? 0

    const appRows = await tx
      .select()
      .from(main.becomePartnerApplications)
      .where(where)
      .orderBy(
        asc(main.becomePartnerApplications.status),
        desc(main.becomePartnerApplications.createdAt)
      )
      .limit(limit)
      .offset(offset)

    const userIds = [...new Set(appRows.map((r) => r.applicantUserId))]
    const userRows =
      userIds.length > 0
        ? await tx
            .select()
            .from(main.users)
            .where(inArray(main.users.id, userIds))
        : []
    const usersById = new Map(userRows.map((u) => [u.id, u]))

    return {
      rows: appRows.map((app) =>
        mapRow(app, usersById.get(app.applicantUserId) ?? null)
      ),
      total,
    }
  })
}

export async function getApplicationById(
  id: string
): Promise<AdminApplicationRow | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select()
      .from(main.becomePartnerApplications)
      .where(
        and(
          eq(main.becomePartnerApplications.id, id),
          isNull(main.becomePartnerApplications.deletedAt)
        )
      )
      .limit(1)

    const app = rows[0]
    if (!app) return null

    const userRows = await tx
      .select()
      .from(main.users)
      .where(eq(main.users.id, app.applicantUserId))
      .limit(1)

    return mapRow(app, userRows[0] ?? null)
  })
}

export async function claimApplication(
  id: string,
  reviewerUserId: string
): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.becomePartnerApplications)
      .set({
        status: "under_review",
        reviewerUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(main.becomePartnerApplications.id, id),
          eq(main.becomePartnerApplications.status, "submitted")
        )
      )
  })
}

export async function rejectApplication(
  id: string,
  reviewerUserId: string,
  reason: string
): Promise<void> {
  const now = new Date()
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.becomePartnerApplications)
      .set({
        status: "rejected",
        reviewerUserId,
        reviewedAt: now,
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(main.becomePartnerApplications.id, id),
          inArray(main.becomePartnerApplications.status, [
            "submitted",
            "under_review",
          ])
        )
      )
  })
}

/**
 * Approve a Become-Partner application. This:
 * 1. Creates a solo_expert organization
 * 2. Creates a membership linking the applicant to that org
 * 3. Creates an expert_profiles row with status='draft'
 * 4. Updates the application with provisioned org + approved status
 *
 * Returns the new expert profile ID and org ID for downstream use
 * (e.g. Stripe Connect account creation).
 */
export interface ApproveApplicationResult {
  expertProfileId: string
  orgId: string
  userId: string
  username: string
}

export async function approveApplication(
  id: string,
  reviewerUserId: string
): Promise<ApproveApplicationResult> {
  return withPlatformAdminContext(async (tx) => {
    const apps = await tx
      .select()
      .from(main.becomePartnerApplications)
      .where(
        and(
          eq(main.becomePartnerApplications.id, id),
          inArray(main.becomePartnerApplications.status, [
            "submitted",
            "under_review",
          ])
        )
      )
      .limit(1)

    const app = apps[0]
    if (!app) {
      throw new Error(`Application ${id} not found or not in reviewable state`)
    }

    const now = new Date()

    const [org] = await tx
      .insert(main.organizations)
      .values({
        workosOrgId: `pending_${app.applicantUserId}`,
        type: app.type === "clinic_admin" ? "clinic" : "solo_expert",
        displayName: app.displayName,
      })
      .returning({ id: main.organizations.id })

    if (!org) throw new Error("Failed to create organization")

    await tx.insert(main.memberships).values({
      orgId: org.id,
      userId: app.applicantUserId,
      workosRole: "admin",
    })

    const [profile] = await tx
      .insert(main.expertProfiles)
      .values({
        orgId: org.id,
        userId: app.applicantUserId,
        username: app.usernameRequested,
        displayName: app.displayName,
        bio: app.bio,
        nif: app.nif,
        licenseScope: app.licenseScope,
        languages: app.languages,
        practiceCountries: app.practiceCountries,
        status: "draft",
      })
      .returning({ id: main.expertProfiles.id })

    if (!profile) throw new Error("Failed to create expert profile")

    if (app.categorySlugs.length > 0) {
      const categories = await tx
        .select({
          id: main.expertCategories.id,
          slug: main.expertCategories.slug,
        })
        .from(main.expertCategories)
        .where(inArray(main.expertCategories.slug, app.categorySlugs))

      if (categories.length > 0) {
        await tx.insert(main.expertListings).values(
          categories.map((cat) => ({
            orgId: org.id,
            expertProfileId: profile.id,
            categoryId: cat.id,
          }))
        )
      }
    }

    await tx
      .update(main.becomePartnerApplications)
      .set({
        status: "approved",
        reviewerUserId,
        reviewedAt: now,
        provisionedOrgId: org.id,
        updatedAt: now,
      })
      .where(eq(main.becomePartnerApplications.id, id))

    return {
      expertProfileId: profile.id,
      orgId: org.id,
      userId: app.applicantUserId,
      username: app.usernameRequested,
    }
  })
}

/**
 * Fetch an expert profile by user ID (used after approval to check
 * onboarding state).
 */
export async function getExpertProfileByUserId(
  userId: string
): Promise<main.ExpertProfile | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select()
      .from(main.expertProfiles)
      .where(
        and(
          eq(main.expertProfiles.userId, userId),
          isNull(main.expertProfiles.deletedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  })
}

/**
 * Update expert profile fields (used by onboarding wizard steps).
 */
export async function updateExpertProfile(
  profileId: string,
  orgId: string,
  data: Partial<main.NewExpertProfile>
): Promise<void> {
  const { withOrgContext } = await import("../context")
  await withOrgContext(orgId, async (tx: Tx) => {
    await tx
      .update(main.expertProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(main.expertProfiles.id, profileId))
  })
}
