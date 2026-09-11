import { CancelDeletionResponseSchema } from "@eleva/api-client"
import {
  AccountDeletionNotPendingError,
  cancelAccountDeletion,
} from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
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
    const cancelled = await cancelAccountDeletion({
      userId: session.user.id,
      orgId: session.orgId,
    })
    return secureJson(
      CancelDeletionResponseSchema.parse({ requestId: cancelled.requestId }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof AccountDeletionNotPendingError) {
      return secureJson({ error: err.code }, { status: 409, headers })
    }
    console.error("[privacy/cancel-deletion] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
