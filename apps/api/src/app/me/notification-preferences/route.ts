import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { PutNotificationPreferencesRequestSchema } from "@eleva/api-client"
import { updateMemberNotificationPreferences } from "@eleva/auth"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function toPgTime(value: string | null): string | null {
  if (value == null) return null
  return value.length === 5 ? `${value}:00` : value
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request, "PUT, OPTIONS")

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
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = PutNotificationPreferencesRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const preferences = await updateMemberNotificationPreferences({
    userId: session.user.id,
    orgId: session.orgId,
    timezone: body.data.timezone,
    quietHoursStart:
      body.data.quietHoursStart === undefined
        ? undefined
        : toPgTime(body.data.quietHoursStart),
    quietHoursEnd:
      body.data.quietHoursEnd === undefined
        ? undefined
        : toPgTime(body.data.quietHoursEnd),
    preferences: body.data.preferences,
  })

  return secureJson({ preferences }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PUT, OPTIONS"),
  })
}
