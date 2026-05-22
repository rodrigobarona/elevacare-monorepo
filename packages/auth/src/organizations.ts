import { inArray } from "drizzle-orm"
import { db, main } from "@eleva/db"
import type { OrgType, WorkosRole } from "@eleva/db/schema"
import { deriveProductLabel } from "./capabilities"
import {
  provisionMembership,
  provisionOrganization,
  type ProvisionOrganizationResult,
} from "./provisioning"
import type { ProductLabel } from "./types"
import { getWorkOS } from "./workos-client"

export interface UserOrganizationItem {
  workosOrgId: string
  orgId: string
  orgSlug: string
  orgType: OrgType
  name: string
  workosRole: WorkosRole
  productLabel: ProductLabel
  isCurrent: boolean
}

export interface ListUserOrganizationsInput {
  workosUserId: string
  currentWorkosOrgId: string | null
}

export type CreateOrganizationType = OrgType

export interface CreateOrganizationInput {
  workosUserId: string
  userId: string
  name: string
  type: CreateOrganizationType
}

export interface CreateOrganizationResult extends ProvisionOrganizationResult {
  workosOrgId: string
}

function formatSlugAsName(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveWorkosRole(membership: {
  role?: { slug?: string } | null
  roles?: Array<{ slug?: string }> | null
}): WorkosRole {
  const roleSlugs = membership.roles?.map((role) => role.slug) ?? []
  return membership.role?.slug === "admin" || roleSlugs.includes("admin")
    ? "admin"
    : "member"
}

/**
 * Lists organizations the user belongs to, enriched with WorkOS display names
 * and Eleva org metadata. Shared by API routes and server-side UI loaders.
 */
export async function listUserOrganizations(
  input: ListUserOrganizationsInput
): Promise<UserOrganizationItem[]> {
  const workos = getWorkOS()

  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: input.workosUserId,
    statuses: ["active"],
  })

  if (memberships.data.length === 0) return []

  const workosOrgIds = memberships.data.map((m) => m.organizationId)

  const orgRows = await db()
    .select({
      id: main.organizations.id,
      workosOrgId: main.organizations.workosOrgId,
      slug: main.organizations.slug,
      type: main.organizations.type,
    })
    .from(main.organizations)
    .where(inArray(main.organizations.workosOrgId, workosOrgIds))

  const byWorkosId = new Map(orgRows.map((r) => [r.workosOrgId, r]))

  const orgs = await Promise.all(
    memberships.data.map(async (m) => {
      const row = byWorkosId.get(m.organizationId)
      if (!row?.slug) return null

      let name: string
      try {
        const org = await workos.organizations.getOrganization(m.organizationId)
        name = org.name
      } catch {
        name = formatSlugAsName(row.slug)
      }

      const workosRole = resolveWorkosRole(m)
      const orgType = row.type

      return {
        workosOrgId: m.organizationId,
        orgId: row.id,
        orgSlug: row.slug,
        orgType,
        name,
        workosRole,
        productLabel: deriveProductLabel(orgType, workosRole),
        isCurrent: m.organizationId === input.currentWorkosOrgId,
      }
    })
  )

  return orgs.filter((org): org is UserOrganizationItem => org !== null)
}

/**
 * Creates a WorkOS organization + Eleva DB mirror for the authenticated user.
 * Billing provisioning remains the API route's responsibility.
 */
export async function createOrganization(
  input: CreateOrganizationInput
): Promise<CreateOrganizationResult> {
  const workos = getWorkOS()

  const workosOrg = await workos.organizations.createOrganization({
    name: input.name,
  })

  await workos.userManagement.createOrganizationMembership({
    userId: input.workosUserId,
    organizationId: workosOrg.id,
    roleSlug: "admin",
  })

  const result = await provisionOrganization({
    workosOrgId: workosOrg.id,
    name: input.name,
    type: input.type,
    actorUserId: input.userId,
  })

  await Promise.allSettled([
    workos.organizations.updateOrganization({
      organization: workosOrg.id,
      externalId: result.orgId,
      metadata: { slug: result.slug, org_type: input.type },
    }),
  ])

  await provisionMembership({
    userId: input.userId,
    orgId: result.orgId,
    role: "admin",
    actorUserId: input.userId,
  })

  return {
    ...result,
    workosOrgId: workosOrg.id,
  }
}
