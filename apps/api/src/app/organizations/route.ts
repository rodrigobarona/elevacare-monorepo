import {
  CreateOrganizationRequestSchema,
  CreateWorkspaceRequestSchema,
} from "@eleva/api-client"
import { createOrganization } from "@eleva/auth"
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

  const rawBody = await request.json().catch(() => ({}))
  const workspaceBody = CreateWorkspaceRequestSchema.safeParse(rawBody)
  const body = workspaceBody.success
    ? workspaceBody
    : CreateOrganizationRequestSchema.safeParse(rawBody)

  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const result = await createOrganization({
    workosUserId: session.user.workosUserId,
    userId: session.user.id,
    name: body.data.name,
    type: body.data.type,
  })

  if (result.created) {
    try {
      await provisionOrgBilling({
        orgId: result.orgId,
        workosOrgId: result.workosOrgId,
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
      workosOrgId: result.workosOrgId,
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
