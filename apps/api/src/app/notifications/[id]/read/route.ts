import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { InboxNotificationIdSchema } from "@eleva/api-client"
import { InboxNotFoundError, markInboxRead } from "@eleva/notifications"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const { id } = await context.params
  const parsedId = InboxNotificationIdSchema.safeParse(id)
  if (!parsedId.success) {
    return secureJson(
      { error: "validation", issues: parsedId.error.issues },
      { status: 422, headers }
    )
  }
  try {
    const result = await markInboxRead({
      userId: session.user.id,
      orgId: session.orgId,
      notificationId: parsedId.data,
    })
    return secureJson(result, { status: 200, headers })
  } catch (error) {
    if (error instanceof InboxNotFoundError) {
      return secureJson({ error: "not found" }, { status: 404, headers })
    }
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
