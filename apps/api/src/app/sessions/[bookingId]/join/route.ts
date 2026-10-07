import { JoinSessionResponseSchema } from "@eleva/api-client"
import { joinSession, SessionJoinError } from "@eleva/workflows/video"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
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

const JOIN_STATUS: Record<SessionJoinError["code"], number> = {
  NOT_A_PARTICIPANT: 403,
  SESSION_NOT_OPEN: 403,
  SESSION_NOT_ACTIVE: 410,
  ROOM_NOT_READY: 409,
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const { bookingId } = await params

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
    const result = await joinSession({
      bookingId,
      userId: session.user.id,
      userName: session.user.displayName?.trim() || "Member",
    })
    return secureJson(JoinSessionResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (err instanceof SessionJoinError) {
      return secureJson(
        { error: err.code },
        { status: JOIN_STATUS[err.code], headers }
      )
    }
    console.error("[sessions/join] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
