import { SetActiveOrganizationRequestSchema } from "@eleva/api-client"
import { setActiveElevaOrganization } from "@eleva/auth"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requirePrivilegedApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requirePrivilegedApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const parsed = SetActiveOrganizationRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  await setActiveElevaOrganization({
    headers: request.headers,
    orgId: parsed.data.organizationId,
    actorUserId: session.user.id,
  })

  return secureJson(
    { ok: true as const, organizationId: parsed.data.organizationId },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
