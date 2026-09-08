import { eq } from "drizzle-orm"
import { auth as authTables, db } from "@eleva/db"
import { capabilitiesFor, deriveProductLabel } from "./capabilities"
import type { ElevaSession } from "./types"

export function pickMembershipRow<T extends { orgId: string; orgSlug: string }>(
  rows: T[],
  input: { orgId: string | null; preferredOrgSlug?: string }
): T | null {
  if (rows.length === 0) return null
  if (input.preferredOrgSlug) {
    return rows.find((row) => row.orgSlug === input.preferredOrgSlug) ?? null
  }
  if (input.orgId) {
    return rows.find((row) => row.orgId === input.orgId) ?? null
  }
  return rows[0]!
}

function buildSession(
  input: {
    userId: string
    email: string
    name: string | null
    image: string | null
  },
  preferred: {
    orgId: string
    role: string
    orgType: string
    orgSlug: string
  }
): ElevaSession {
  const orgType = preferred.orgType as ElevaSession["orgType"]
  const workosRole =
    preferred.role === "member" ? ("member" as const) : ("admin" as const)
  const productLabel = deriveProductLabel(
    orgType,
    preferred.role === "owner" ? "owner" : workosRole
  )

  return {
    user: {
      id: input.userId,
      workosUserId: input.userId,
      email: input.email,
      displayName: input.name,
      avatarUrl: input.image,
    },
    orgId: preferred.orgId,
    workosOrgId: preferred.orgId,
    orgSlug: preferred.orgSlug,
    productLabel,
    orgType,
    workosRole,
    capabilities: capabilitiesFor(productLabel),
  }
}

export async function loadElevaSession(input: {
  userId: string
  email: string
  name: string | null
  image: string | null
  orgId: string | null
  preferredOrgSlug?: string
}): Promise<ElevaSession | null> {
  const rows = await db()
    .select({
      orgId: authTables.organization.id,
      role: authTables.member.role,
      orgType: authTables.organization.type,
      orgSlug: authTables.organization.slug,
    })
    .from(authTables.member)
    .innerJoin(
      authTables.organization,
      eq(authTables.member.organizationId, authTables.organization.id)
    )
    .where(eq(authTables.member.userId, input.userId))

  const preferred = pickMembershipRow(rows, input)
  if (!preferred) return null
  return buildSession(input, preferred)
}
