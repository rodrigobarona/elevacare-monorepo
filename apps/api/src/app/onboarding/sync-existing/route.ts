import { completeOnboarding, UnauthorizedError } from "@eleva/auth"
import { getWorkOS } from "@eleva/auth/server"
import { provisionOrgBilling } from "@eleva/billing/server"
import { LocaleSchema } from "@eleva/config/i18n"
import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z
  .object({
    locale: LocaleSchema.optional(),
  })
  .optional()

export async function POST(request: Request): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.onboarding
  )
  if (rateLimited) return rateLimited

  const body = BodySchema.safeParse(await request.json().catch(() => undefined))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const workos = getWorkOS()
  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: session.user.workosUserId,
    limit: 1,
  })

  if (memberships.data.length === 0) {
    return secureJson({ hasMembership: false }, { headers })
  }

  const membership = memberships.data[0]!
  const workosOrg = await workos.organizations.getOrganization(
    membership.organizationId
  )
  const role = membership.role?.slug === "admin" ? "admin" : "member"
  const orgMetadata = workosOrg.metadata as Record<string, unknown> | undefined
  const orgType =
    orgMetadata?.org_type === "expert" ||
    orgMetadata?.org_type === "team" ||
    orgMetadata?.org_type === "staff" ||
    orgMetadata?.org_type === "personal"
      ? orgMetadata.org_type
      : "personal"

  const result = await completeOnboarding({
    workosUserId: session.user.workosUserId,
    workosOrgId: membership.organizationId,
    orgName: workosOrg.name,
    role,
    orgType,
    actorUserId: session.user.id,
  })

  await Promise.allSettled([
    workos.userManagement.updateUser({
      userId: session.user.workosUserId,
      externalId: result.userId,
      ...(body.data?.locale && { locale: body.data.locale }),
    }),
    workos.organizations.updateOrganization({
      organization: membership.organizationId,
      externalId: result.orgId,
      metadata: { slug: result.slug, org_type: orgType },
    }),
  ])

  try {
    await provisionOrgBilling({
      orgId: result.orgId,
      workosOrgId: membership.organizationId,
      orgName: workosOrg.name,
      orgType,
      email: session.user.email,
      actorUserId: session.user.id,
    })
  } catch (err) {
    console.error(
      "[onboarding/sync-existing] Billing provisioning failed:",
      err instanceof Error ? err.message : err
    )
  }

  return secureJson(
    {
      hasMembership: true,
      userId: result.userId,
      orgId: result.orgId,
      slug: result.slug,
    },
    { headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
