import { eq, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { auth, db, main, findExistingOrgSlugs } from "@eleva/db"
import type { OrgType, WorkosRole } from "@eleva/db/schema"
import { generateUniqueOrgSlug } from "@eleva/config/slug"
import { deriveProductLabel } from "./capabilities"
import { getAuthApi } from "./server/auth"
import {
  provisionOrganizationWithAdminMembership,
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

export async function listAuthOrganizations(
  userId: string,
  currentOrgId: string | null
): Promise<UserOrganizationItem[]> {
  const rows = await db()
    .select({
      orgId: auth.organization.id,
      orgSlug: auth.organization.slug,
      orgType: auth.organization.type,
      name: auth.organization.name,
      role: auth.member.role,
    })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(eq(auth.member.userId, userId))

  return rows.map((row) => {
    const orgType = row.orgType as OrgType
    const workosRole: WorkosRole = row.role === "member" ? "member" : "admin"
    return {
      workosOrgId: row.orgId,
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      orgType,
      name: row.name,
      workosRole,
      productLabel: deriveProductLabel(
        orgType,
        row.role === "owner" ? "owner" : workosRole
      ),
      isCurrent: row.orgId === currentOrgId,
    }
  })
}

export async function setActiveElevaOrganization(input: {
  headers: Headers
  orgId: string
  actorUserId: string
}): Promise<void> {
  await getAuthApi().setActiveOrganization({
    headers: input.headers,
    body: { organizationId: input.orgId },
  })
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "organization",
        action: "updated",
        entityId: input.orgId,
        payload: { active: true },
      })
    }
  )
}

export async function addOrganizationMember(input: {
  userId: string
  orgId: string
  role: "admin" | "member" | "owner"
  actorUserId: string
}): Promise<void> {
  await getAuthApi().addMember({
    body: {
      userId: input.userId,
      organizationId: input.orgId,
      role: input.role === "admin" ? "admin" : input.role,
    },
  })
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "membership",
        action: "created",
        entityId: input.userId,
        payload: { orgId: input.orgId, role: input.role },
      })
    }
  )
}

export async function createElevaOrganization(input: {
  userId: string
  name: string
  type: CreateOrganizationType
}): Promise<CreateOrganizationResult> {
  const slug = await generateUniqueOrgSlug(input.name, findExistingOrgSlugs)
  const created = await getAuthApi().createOrganization({
    body: {
      name: input.name,
      slug,
      userId: input.userId,
      type: input.type,
    },
  })
  const organization = (
    created as { id?: string; organization?: { id?: string } } | null
  )?.organization
  const orgId = (created as { id?: string } | null)?.id ?? organization?.id
  if (!orgId) {
    throw new Error("createOrganization did not return an id")
  }

  await withAudit({ orgId, actorUserId: input.userId }, async (_tx, ctx) => {
    await ctx.emit({
      entity: "organization",
      action: "created",
      entityId: orgId,
      payload: { type: input.type, name: input.name, slug },
    })
  })

  return {
    orgId,
    slug,
    created: true,
    workosOrgId: orgId,
  }
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

  try {
    await workos.userManagement.createOrganizationMembership({
      userId: input.workosUserId,
      organizationId: workosOrg.id,
      roleSlug: "admin",
    })

    const result = await provisionOrganizationWithAdminMembership({
      workosOrgId: workosOrg.id,
      name: input.name,
      type: input.type,
      userId: input.userId,
      actorUserId: input.userId,
    })

    await Promise.allSettled([
      workos.organizations.updateOrganization({
        organization: workosOrg.id,
        externalId: result.orgId,
        metadata: { slug: result.slug, org_type: input.type },
      }),
    ])

    return {
      ...result,
      workosOrgId: workosOrg.id,
    }
  } catch (err) {
    await Promise.allSettled([
      workos.organizations.deleteOrganization(workosOrg.id),
    ])
    throw err
  }
}
