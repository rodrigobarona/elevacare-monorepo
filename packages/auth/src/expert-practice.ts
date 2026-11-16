import { and, asc, eq } from "drizzle-orm"
import { auth, db } from "@eleva/db"
import { toMembershipSeniority } from "./capabilities"

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

/** This person's memberships in expert organizations, oldest first. */
export function expertMembershipsQuery(userId: string) {
  return db()
    .select({
      orgId: auth.organization.id,
      slug: auth.organization.slug,
      name: auth.organization.name,
      role: auth.member.role,
    })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(
      and(eq(auth.member.userId, userId), eq(auth.organization.type, "expert"))
    )
    .orderBy(asc(auth.organization.createdAt))
}

/**
 * The practice the person owns among those memberships. Only the owner
 * counts (Better Auth may store a role list such as `owner,admin`): an admin
 * may be someone helping in another person's practice, which is not theirs.
 */
export function pickOwnedPractice(
  rows: readonly (OwnedExpertPractice & { role: string })[]
): OwnedExpertPractice | null {
  const owned = rows.find((row) => toMembershipSeniority(row.role) === "owner")
  return owned
    ? { orgId: owned.orgId, slug: owned.slug, name: owned.name }
    : null
}

/** The expert practice this person owns, if any. */
export async function findOwnedExpertPractice(
  userId: string
): Promise<OwnedExpertPractice | null> {
  return pickOwnedPractice(await expertMembershipsQuery(userId))
}

/** Message when a second practice is requested; null when it is allowed. */
export function expertPracticeViolation(
  type: unknown,
  existing: OwnedExpertPractice | null
): string | null {
  if (type !== "expert" || !existing) return null
  return `You already have an expert practice (${existing.slug}). Add specialties and services there instead of creating another one.`
}

/**
 * Guard for Better Auth's `beforeCreateOrganization`: the message when this
 * person may not create the organization, null when they may.
 */
export async function secondExpertPracticeViolation(
  organization: Record<string, unknown>,
  userId: string,
  find: (
    userId: string
  ) => Promise<OwnedExpertPractice | null> = findOwnedExpertPractice
): Promise<string | null> {
  if (organization.type !== "expert") return null
  return expertPracticeViolation(organization.type, await find(userId))
}
