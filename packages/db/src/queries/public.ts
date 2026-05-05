import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import { isReserved } from "@eleva/config/reserved-usernames"

import { withPlatformAdminContext } from "../context"
import * as main from "../schema/main"

/**
 * Public marketplace queries.
 *
 * Reads here happen via `withPlatformAdminContext` so RLS lets us scan
 * across tenants. Every query MUST project only public-safe columns
 * and MUST filter on a `status` column to exclude draft/suspended
 * rows. Mutations live elsewhere (server actions wrapped in
 * withAudit + withOrgContext).
 *
 * Boundary: callers in apps/web (gateway) consume these via server
 * components / server actions. Never call from client components.
 */

export interface PublicExpertCard {
  username: string
  displayName: string
  headline: string | null
  bio: string | null
  avatarUrl: string | null
  languages: string[]
  practiceCountries: string[]
  sessionModes: main.SessionMode[]
  topExpertActive: boolean
  /** Category slugs the expert lists themselves under. */
  categorySlugs: string[]
}

export interface PublicExpertProfile extends PublicExpertCard {
  id: string
  /** ISO-639-1 + ISO-3166-1 — we keep them denormalised for cards. */
  worldwideMode: boolean
}

export interface PublicClinicProfile {
  id: string
  slug: string
  displayName: string
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  countryCode: string | null
}

export interface PublicCategory {
  id: string
  slug: string
  displayName: main.LocalizedString
  description: main.LocalizedString | null
  icon: string | null
  sortOrder: number
}

export interface ListExpertsFilters {
  /** Restrict to one category slug. */
  categorySlug?: string
  /** ISO-639-1 codes; expert must support at least one. */
  languages?: string[]
  /** ISO-3166-1 alpha-2 codes; expert must practice in at least one. */
  countries?: string[]
  /** Restrict to experts offering at least one of these session modes. */
  sessionModes?: main.SessionMode[]
  /** Free-text search on displayName/headline/bio (case-insensitive). */
  search?: string
  /** Pagination — defaults to (page=1, pageSize=24). */
  page?: number
  pageSize?: number
}

export interface ListExpertsResult {
  experts: PublicExpertCard[]
  total: number
  page: number
  pageSize: number
}

/**
 * Resolve an expert by their public username. Returns null when:
 * - username does not match the format check (defensive — most filters
 *   rejected before we get here)
 * - no expert profile exists with status='active' for that username
 *
 * Username comparison is case-insensitive (lower(username) = lower($1))
 * but the column is stored already-lowercased per the CHECK constraint.
 */
export async function findExpertByUsername(
  username: string
): Promise<PublicExpertProfile | null> {
  const lowered = username.trim().toLowerCase()
  if (lowered.length === 0) return null
  if (isReserved(lowered)) return null

  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        id: main.expertProfiles.id,
        username: main.expertProfiles.username,
        displayName: main.expertProfiles.displayName,
        headline: main.expertProfiles.headline,
        bio: main.expertProfiles.bio,
        avatarUrl: main.expertProfiles.avatarUrl,
        languages: main.expertProfiles.languages,
        practiceCountries: main.expertProfiles.practiceCountries,
        sessionModes: main.expertProfiles.sessionModes,
        topExpertActive: main.expertProfiles.topExpertActive,
        worldwideMode: main.expertProfiles.worldwideMode,
      })
      .from(main.expertProfiles)
      .where(
        and(
          eq(main.expertProfiles.username, lowered),
          eq(main.expertProfiles.status, "active"),
          isNull(main.expertProfiles.deletedAt)
        )
      )
      .limit(1)

    const expert = rows[0]
    if (!expert) return null

    const listings = await tx
      .select({ slug: main.expertCategories.slug })
      .from(main.expertListings)
      .innerJoin(
        main.expertCategories,
        eq(main.expertListings.categoryId, main.expertCategories.id)
      )
      .where(eq(main.expertListings.expertProfileId, expert.id))
      .orderBy(asc(main.expertListings.sortOrder))

    return {
      ...expert,
      categorySlugs: listings.map((l) => l.slug),
    }
  })
}

/**
 * Resolve a clinic by its public slug. Returns null when the slug is
 * reserved, empty, or no clinic_profiles row matches.
 *
 * Clinic profiles share the public namespace with expert profiles
 * (search-and-discovery-spec.md). Resolution at /[username] tries
 * experts first; this query is the fallback path.
 */
export async function findClinicBySlug(
  slug: string
): Promise<PublicClinicProfile | null> {
  const lowered = slug.trim().toLowerCase()
  if (lowered.length === 0) return null
  if (isReserved(lowered)) return null

  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        id: main.clinicProfiles.id,
        slug: main.clinicProfiles.slug,
        displayName: main.clinicProfiles.displayName,
        description: main.clinicProfiles.description,
        logoUrl: main.clinicProfiles.logoUrl,
        websiteUrl: main.clinicProfiles.websiteUrl,
        countryCode: main.clinicProfiles.countryCode,
      })
      .from(main.clinicProfiles)
      .where(
        and(
          eq(main.clinicProfiles.slug, lowered),
          isNull(main.clinicProfiles.deletedAt)
        )
      )
      .limit(1)

    return rows[0] ?? null
  })
}

/**
 * List all public expert categories ordered by sortOrder.
 */
export async function listCategories(): Promise<PublicCategory[]> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        id: main.expertCategories.id,
        slug: main.expertCategories.slug,
        displayName: main.expertCategories.displayName,
        description: main.expertCategories.description,
        icon: main.expertCategories.icon,
        sortOrder: main.expertCategories.sortOrder,
      })
      .from(main.expertCategories)
      .orderBy(
        asc(main.expertCategories.sortOrder),
        asc(main.expertCategories.slug)
      )

    return rows
  })
}

/**
 * List active experts with optional filters. Returns a paginated set
 * sorted by displayName for stable cursoring (we add ranking signals
 * in S3 once availability is wired).
 */
export async function listExperts(
  filters: ListExpertsFilters = {}
): Promise<ListExpertsResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(filters.pageSize ?? 24)))

  return withPlatformAdminContext(async (tx) => {
    const conditions = [
      eq(main.expertProfiles.status, "active"),
      isNull(main.expertProfiles.deletedAt),
    ]

    if (filters.languages && filters.languages.length > 0) {
      conditions.push(
        sql`${main.expertProfiles.languages} && ${filters.languages}::text[]`
      )
    }

    if (filters.countries && filters.countries.length > 0) {
      conditions.push(
        sql`${main.expertProfiles.practiceCountries} && ${filters.countries}::text[]`
      )
    }

    if (filters.sessionModes && filters.sessionModes.length > 0) {
      conditions.push(
        sql`${main.expertProfiles.sessionModes} && ${filters.sessionModes}::session_mode[]`
      )
    }

    if (filters.search && filters.search.trim().length >= 2) {
      const q = `%${filters.search.trim()}%`
      const searchClause = or(
        ilike(main.expertProfiles.displayName, q),
        ilike(main.expertProfiles.headline, q),
        ilike(main.expertProfiles.bio, q)
      )
      if (searchClause) conditions.push(searchClause)
    }

    if (filters.categorySlug) {
      const matchingExpertIds = tx
        .select({ id: main.expertListings.expertProfileId })
        .from(main.expertListings)
        .innerJoin(
          main.expertCategories,
          eq(main.expertListings.categoryId, main.expertCategories.id)
        )
        .where(eq(main.expertCategories.slug, filters.categorySlug))
      conditions.push(inArray(main.expertProfiles.id, matchingExpertIds))
    }

    const where = and(...conditions)

    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(main.expertProfiles)
      .where(where)
    const count = countRows[0]?.count ?? 0

    const rows = await tx
      .select({
        id: main.expertProfiles.id,
        username: main.expertProfiles.username,
        displayName: main.expertProfiles.displayName,
        headline: main.expertProfiles.headline,
        bio: main.expertProfiles.bio,
        avatarUrl: main.expertProfiles.avatarUrl,
        languages: main.expertProfiles.languages,
        practiceCountries: main.expertProfiles.practiceCountries,
        sessionModes: main.expertProfiles.sessionModes,
        topExpertActive: main.expertProfiles.topExpertActive,
      })
      .from(main.expertProfiles)
      .where(where)
      .orderBy(asc(main.expertProfiles.displayName))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    if (rows.length === 0) {
      return { experts: [], total: count, page, pageSize }
    }

    const expertIds = rows.map((r) => r.id)
    const listingRows = await tx
      .select({
        expertId: main.expertListings.expertProfileId,
        slug: main.expertCategories.slug,
        sortOrder: main.expertListings.sortOrder,
      })
      .from(main.expertListings)
      .innerJoin(
        main.expertCategories,
        eq(main.expertListings.categoryId, main.expertCategories.id)
      )
      .where(inArray(main.expertListings.expertProfileId, expertIds))
      .orderBy(asc(main.expertListings.sortOrder))

    const slugsByExpert = new Map<string, string[]>()
    for (const lr of listingRows) {
      const existing = slugsByExpert.get(lr.expertId) ?? []
      existing.push(lr.slug)
      slugsByExpert.set(lr.expertId, existing)
    }

    const experts: PublicExpertCard[] = rows.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      headline: r.headline,
      bio: r.bio,
      avatarUrl: r.avatarUrl,
      languages: r.languages,
      practiceCountries: r.practiceCountries,
      sessionModes: r.sessionModes,
      topExpertActive: r.topExpertActive,
      categorySlugs: slugsByExpert.get(r.id) ?? [],
    }))

    return { experts, total: count, page, pageSize }
  })
}

export interface SlugAvailability {
  /** True if the candidate is open for registration. */
  available: boolean
  /**
   * Reason the candidate is unavailable. Only populated when
   * available === false.
   */
  reason?:
    | "reserved"
    | "format-invalid"
    | "expert-taken"
    | "clinic-taken"
    | "pending-application"
}

/**
 * Cross-namespace availability check for a public slug. Used by both
 * the Become-Partner username picker and the clinic-signup slug
 * picker. Order:
 *   1. Reserved list short-circuit.
 *   2. expert_profiles.username (lowercase).
 *   3. clinic_profiles.slug (lowercase).
 *   4. become_partner_applications.username_requested where status in
 *      ('submitted', 'under_review') — soft-reservation while admin
 *      reviews the application.
 *
 * NOTE: This function does NOT validate the format. Callers must run
 * validateUsername() before calling so the reason='format-invalid'
 * branch is meaningful.
 */
export async function checkPublicSlugAvailability(
  slug: string
): Promise<SlugAvailability> {
  const lowered = slug.trim().toLowerCase()
  if (lowered.length === 0) {
    return { available: false, reason: "format-invalid" }
  }
  if (isReserved(lowered)) return { available: false, reason: "reserved" }

  return withPlatformAdminContext(async (tx) => {
    const expertHit = await tx
      .select({ id: main.expertProfiles.id })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.username, lowered))
      .limit(1)
    if (expertHit.length > 0) {
      return { available: false, reason: "expert-taken" as const }
    }

    const clinicHit = await tx
      .select({ id: main.clinicProfiles.id })
      .from(main.clinicProfiles)
      .where(eq(main.clinicProfiles.slug, lowered))
      .limit(1)
    if (clinicHit.length > 0) {
      return { available: false, reason: "clinic-taken" as const }
    }

    const pendingHit = await tx
      .select({ id: main.becomePartnerApplications.id })
      .from(main.becomePartnerApplications)
      .where(
        and(
          eq(main.becomePartnerApplications.usernameRequested, lowered),
          inArray(main.becomePartnerApplications.status, [
            "submitted",
            "under_review",
          ])
        )
      )
      .limit(1)
    if (pendingHit.length > 0) {
      return { available: false, reason: "pending-application" as const }
    }

    return { available: true }
  })
}
