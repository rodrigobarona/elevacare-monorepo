import { eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { auth, db, findExistingOrgSlugs } from "@eleva/db"
import type { OrgType } from "@eleva/db/schema"
import { generateUniqueOrgSlug } from "@eleva/config/slug"
import {
  deriveProductLabel,
  normalizeMembershipRole,
  toMembershipSeniority,
} from "./capabilities"
import { getAuthApi } from "./server/auth"
import type { MembershipRole, ProductLabel } from "./types"

export interface UserOrganizationItem {
  orgId: string
  orgSlug: string
  orgType: OrgType
  name: string
  membershipRole: MembershipRole
  productLabel: ProductLabel
  isCurrent: boolean
}

export type CreateOrganizationType = OrgType

export interface CreateOrganizationInput {
  userId: string
  name: string
  type: CreateOrganizationType
}

export interface CreateOrganizationResult {
  orgId: string
  slug: string
  created: boolean
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
    const seniority = toMembershipSeniority(row.role)
    const membershipRole = normalizeMembershipRole(seniority)
    return {
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      orgType,
      name: row.name,
      membershipRole,
      productLabel: deriveProductLabel(orgType, seniority),
      isCurrent: row.orgId === currentOrgId,
    }
  })
}

/** @deprecated Use {@link listAuthOrganizations}. */
export async function listUserOrganizations(input: {
  userId: string
  currentOrgId: string | null
}): Promise<UserOrganizationItem[]> {
  return listAuthOrganizations(input.userId, input.currentOrgId)
}

export class OrganizationForbiddenError extends Error {
  constructor(message = "not a member of this organization") {
    super(message)
    this.name = "OrganizationForbiddenError"
  }
}

function isForbiddenMembershipError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const record = err as {
    status?: unknown
    statusCode?: unknown
    body?: { message?: unknown; code?: unknown }
    message?: unknown
  }
  if (
    record.statusCode === 403 ||
    record.status === 403 ||
    record.status === "FORBIDDEN"
  ) {
    return true
  }
  const text = [record.message, record.body?.message, record.body?.code]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
  return text.includes("not a member")
}

export async function setActiveElevaOrganization(input: {
  headers: Headers
  orgId: string
  actorUserId: string
}): Promise<void> {
  const api = getAuthApi()
  const current = await api.getSession({ headers: input.headers })
  const previousOrganizationId = current?.session.activeOrganizationId ?? null

  try {
    await api.setActiveOrganization({
      headers: input.headers,
      body: { organizationId: input.orgId },
    })
  } catch (err) {
    if (isForbiddenMembershipError(err)) {
      throw new OrganizationForbiddenError()
    }
    throw err
  }

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "session",
        action: "active_organization_changed",
        entityId: current?.session.id ?? input.actorUserId,
        payload: {
          previousOrganizationId,
          organizationId: input.orgId,
        },
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
  }
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<CreateOrganizationResult> {
  return createElevaOrganization(input)
}
