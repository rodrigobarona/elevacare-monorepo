import { and, asc, eq } from "drizzle-orm"
import { auth, db } from "@eleva/db"

/**
 * One expert practice per person (ADR-026). A practice holds several
 * specialties and services; a separate company or NIF is a Team (clinic),
 * not a second practice. Delegates and clinic seats are memberships in
 * someone else's organization and never count here.
 */
export const EXPERT_PRACTICE_EXISTS = "EXPERT_PRACTICE_EXISTS" as const

export interface OwnedExpertPractice {
  orgId: string
  slug: string
  name: string
}

/** The expert practice this person owns, if any. */
export async function findOwnedExpertPractice(
  userId: string
): Promise<OwnedExpertPractice | null> {
  const [row] = await db()
    .select({
      orgId: auth.organization.id,
      slug: auth.organization.slug,
      name: auth.organization.name,
    })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(
      and(
        eq(auth.member.userId, userId),
        eq(auth.organization.type, "expert"),
        // The owner only: an admin may be someone helping in another
        // person's practice, which is not their own.
        eq(auth.member.role, "owner")
      )
    )
    .orderBy(asc(auth.organization.createdAt))
    .limit(1)
  return row ?? null
}

/** Message when a second practice is requested; null when it is allowed. */
export function expertPracticeViolation(
  type: unknown,
  existing: OwnedExpertPractice | null
): string | null {
  if (type !== "expert" || !existing) return null
  return `You already have an expert practice (${existing.slug}). Add specialties and services there instead of creating another one.`
}
