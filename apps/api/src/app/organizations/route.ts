import { z } from "zod"
import { provisionMembership, provisionOrganization } from "@eleva/auth"
import { getWorkOS } from "@eleva/auth/server"
import { provisionOrgBilling } from "@eleva/billing/server"
import { getOrganizationBySlug } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { UnauthorizedError } from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  type: z.enum(["personal", "expert", "team", "staff"]).default("personal"),
})

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, GET, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const botVerdict = await checkBot()
  if (botVerdict?.isBot) {
    return secureJson({ error: "blocked" }, { status: 403, headers })
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = CreateOrgSchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const workos = getWorkOS()
  const workosOrg = await workos.organizations.createOrganization({
    name: body.data.name,
  })

  await workos.userManagement.createOrganizationMembership({
    userId: session.user.workosUserId,
    organizationId: workosOrg.id,
    roleSlug: "admin",
  })

  const result = await provisionOrganization({
    workosOrgId: workosOrg.id,
    name: body.data.name,
    type: body.data.type,
    actorUserId: session.user.id,
  })

  await Promise.allSettled([
    workos.organizations.updateOrganization({
      organization: workosOrg.id,
      externalId: result.orgId,
      metadata: { slug: result.slug, org_type: body.data.type },
    }),
  ])

  await provisionMembership({
    userId: session.user.id,
    orgId: result.orgId,
    role: "admin",
    actorUserId: session.user.id,
  })

  // W2: provision Stripe billing for every newly-created org so the
  // WorkOS Stripe Add-on can attach entitlements. Non-blocking: a
  // failure here does not roll back org creation; an operator can
  // re-run the backfill script (`backfill-org-customers.ts`).
  if (result.created) {
    try {
      await provisionOrgBilling({
        orgId: result.orgId,
        workosOrgId: workosOrg.id,
        orgName: body.data.name,
        orgType: body.data.type,
        actorUserId: session.user.id,
        email: session.user.email,
      })
    } catch (err) {
      console.warn(
        `[organizations] provisionOrgBilling failed for ${result.orgId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return secureJson(
    {
      orgId: result.orgId,
      slug: result.slug,
      workosOrgId: workosOrg.id,
      created: result.created,
    },
    { status: result.created ? 201 : 200, headers }
  )
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "POST, GET, OPTIONS")

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
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const url = new URL(request.url)
  const slug = url.searchParams.get("slug")

  if (!slug) {
    return secureJson(
      { error: "validation", message: "slug query parameter is required" },
      { status: 422, headers }
    )
  }

  const org = await getOrganizationBySlug(slug)

  if (!org) {
    return secureJson({ error: "not_found" }, { status: 404, headers })
  }

  return secureJson(org, { status: 200, headers, noStore: false })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, GET, OPTIONS"),
  })
}
