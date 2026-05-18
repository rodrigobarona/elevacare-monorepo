import { and, eq, isNull } from "drizzle-orm"

import { withPlatformAdminContext, type Tx } from "../context"
import * as main from "../schema/main"

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
