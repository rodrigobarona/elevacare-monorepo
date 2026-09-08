import { eq } from "drizzle-orm"
import { auth as authTables, db } from "@eleva/db"
import { capabilitiesFor, deriveProductLabel } from "./capabilities"
import type { ElevaSession } from "./types"

export async function loadElevaSession(input: {
  userId: string
  email: string
  name: string | null
  image: string | null
  orgId: string | null
  preferredOrgSlug?: string
  requireOrg?: boolean
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

  if (rows.length === 0) {
    if (input.requireOrg) return null
    return null
  }

  const preferred =
    (input.preferredOrgSlug
      ? rows.find((row) => row.orgSlug === input.preferredOrgSlug)
      : undefined) ??
    (input.orgId ? rows.find((row) => row.orgId === input.orgId) : undefined) ??
    rows[0]!

  if (input.requireOrg && !input.orgId && !input.preferredOrgSlug) {
    return null
  }

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
