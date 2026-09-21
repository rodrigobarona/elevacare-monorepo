import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { VerifyPhoneStartRequestSchema } from "@eleva/api-client"
import { PhoneVerifyError, verifyPhoneStart } from "@eleva/notifications"

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
    RATE_LIMITS.public
  )
  if (rateLimited) return rateLimited

  const body = VerifyPhoneStartRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await verifyPhoneStart({
      userId: session.user.id,
      orgId: session.orgId,
      phoneE164: body.data.phoneE164,
    })
    return secureJson(result, { status: 200, headers })
  } catch (error) {
    if (error instanceof PhoneVerifyError) {
      return secureJson(
        { error: error.code, message: error.message },
        { status: 422, headers }
      )
    }
    throw error
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
