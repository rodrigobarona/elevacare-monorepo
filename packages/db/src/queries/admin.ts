import { and, eq, isNull } from "drizzle-orm"

import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import * as auth from "../schema/auth"
import * as main from "../schema/main"

export interface OrganizationBySlugResult {
  id: string
  slug: string
  type: string
}

/**
 * Look up an organization by its unique slug.
 */
export async function getOrganizationBySlug(
  slug: string
): Promise<OrganizationBySlugResult | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        id: auth.organization.id,
        slug: auth.organization.slug,
        type: auth.organization.type,
      })
      .from(auth.organization)
      .where(eq(auth.organization.slug, slug))
      .limit(1)
    return rows[0] ?? null
  })
}

/**
 * Fetch an expert profile by user ID (used after approval to check
 * onboarding state).
 *
 * @deprecated Prefer {@link getExpertProfileForOrg} in org-scoped routes —
 * a user may have profiles in multiple orgs.
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

/** Org-scoped expert profile lookup for multi-org users. */
export async function getExpertProfileForOrg(
  userId: string,
  orgId: string
): Promise<main.ExpertProfile | null> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(main.expertProfiles)
      .where(
        and(
          eq(main.expertProfiles.userId, userId),
          eq(main.expertProfiles.orgId, orgId),
          isNull(main.expertProfiles.deletedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  })
}

async function selectExpertProfileForOrg(
  tx: Tx,
  userId: string,
  orgId: string
): Promise<main.ExpertProfile | null> {
  const rows = await tx
    .select()
    .from(main.expertProfiles)
    .where(
      and(
        eq(main.expertProfiles.userId, userId),
        eq(main.expertProfiles.orgId, orgId),
        isNull(main.expertProfiles.deletedAt)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export interface EnsureExpertProfileResult {
  profile: main.ExpertProfile
  created: boolean
}

/**
 * Bootstrap a draft profile when an expert org has none yet (self-serve create).
 * Internal — call only from audited domain code (e.g. `@eleva/auth`).
 */
export async function _ensureExpertProfileForOrgDetailed(
  input: {
    userId: string
    orgId: string
    orgSlug: string
    displayName: string
  },
  tx: Tx
): Promise<EnsureExpertProfileResult> {
  const [inserted] = await tx
    .insert(main.expertProfiles)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      username: input.orgSlug,
      displayName: input.displayName,
      languages: ["en"],
      practiceCountry: "PT",
      serviceCountries: ["PT"],
      status: "approved",
    })
    .onConflictDoNothing({
      target: [main.expertProfiles.userId, main.expertProfiles.orgId],
    })
    .returning()

  if (inserted) {
    return { profile: inserted, created: true }
  }

  const existing = await selectExpertProfileForOrg(
    tx,
    input.userId,
    input.orgId
  )
  if (!existing) {
    throw new Error("Failed to create expert profile")
  }

  return { profile: existing, created: false }
}

/**
 * Update expert profile fields (used by onboarding wizard steps).
 */
export async function updateExpertProfile(
  profileId: string,
  orgId: string,
  data: Partial<main.NewExpertProfile>
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    await tx
      .update(main.expertProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(main.expertProfiles.id, profileId))
  })
}
