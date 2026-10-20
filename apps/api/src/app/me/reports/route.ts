import { ListMeReportsResponseSchema } from "@eleva/api-client"
import { withPhiScope } from "@eleva/observability"
import { describeError, listMemberReports, recordLogger } from "@eleva/records"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function handleGET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireMemberApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  try {
    const reports = await listMemberReports({ memberUserId: session.user.id })
    return secureJson(ListMeReportsResponseSchema.parse({ reports }), {
      headers,
    })
  } catch (err) {
    recordLogger.error("me reports failed", { status: describeError(err) })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function GET(request: Request) {
  return withPhiScope(() => handleGET(request))
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
