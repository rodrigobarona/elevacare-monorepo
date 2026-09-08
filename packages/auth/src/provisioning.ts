import { and, eq } from "drizzle-orm"
import { auth, db } from "@eleva/db"
import {
  _ensureExpertProfileForOrgDetailed,
  type EnsureExpertProfileResult,
} from "@eleva/db/queries/admin"
import { withAudit } from "@eleva/audit"
import { UnauthorizedError } from "./types"

export type { EnsureExpertProfileResult } from "@eleva/db/queries/admin"

/**
 * Look up whether a user already has a personal org in Eleva's DB.
 */
export async function findExistingPersonalOrg(
  userId: string
): Promise<{ orgId: string } | null> {
  const [row] = await db()
    .select({
      orgId: auth.organization.id,
    })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.organization.id, auth.member.organizationId)
    )
    .where(
      and(
        eq(auth.member.userId, userId),
        eq(auth.organization.type, "personal")
      )
    )
    .limit(1)

  return row ?? null
}

export async function ensurePersonalOrg(input: {
  userId: string
}): Promise<{ userId: string; orgId: string } | null> {
  const existing = await findExistingPersonalOrg(input.userId)
  if (!existing) return null
  return { userId: input.userId, orgId: existing.orgId }
}

export async function ensureExpertProfileForOrg(input: {
  userId: string
  orgId: string
  orgSlug: string
  displayName: string
  actorUserId: string
}): Promise<EnsureExpertProfileResult> {
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const result = await _ensureExpertProfileForOrgDetailed(input, tx)
      await ctx.emit({
        entity: "expert_profile",
        action: result.created ? "created" : "updated",
        entityId: result.profile.id,
        payload: result.created
          ? { userId: input.userId, orgSlug: input.orgSlug }
          : { ensured: true },
      })
      return result
    }
  )
}

export interface CompleteOnboardingInput {
  userId: string
  orgId: string
}

export interface CompleteOnboardingResult {
  userId: string
  orgId: string
  slug: string
}

/**
 * Confirms the user is a member of the org created during onboarding
 * and returns the slug. Identity rows already live in auth.*.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<CompleteOnboardingResult> {
  const [row] = await db()
    .select({
      orgId: auth.organization.id,
      slug: auth.organization.slug,
    })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.organization.id, auth.member.organizationId)
    )
    .where(
      and(
        eq(auth.member.userId, input.userId),
        eq(auth.member.organizationId, input.orgId)
      )
    )
    .limit(1)

  if (!row) {
    throw new UnauthorizedError(
      "not-a-member",
      "onboarding membership not found"
    )
  }

  return { userId: input.userId, orgId: row.orgId, slug: row.slug }
}
