import {
  AddSessionParticipantRequestSchema,
  AddSessionParticipantResponseSchema,
} from "@eleva/api-client"
import {
  addSessionParticipant,
  SessionParticipantError,
} from "@eleva/workflows/video"
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

const PARTICIPANT_STATUS: Record<SessionParticipantError["code"], number> = {
  NOT_ASSIGNED_EXPERT: 403,
  SESSION_NOT_ACTIVE: 410,
  NOT_FOUND: 404,
  ALREADY_PARTICIPANT: 409,
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

  const parsed = AddSessionParticipantRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const participant = await addSessionParticipant({
      bookingId,
      actorUserId: session.user.id,
      userId: parsed.data.userId,
      role: parsed.data.role,
    })
    return secureJson(
      AddSessionParticipantResponseSchema.parse({
        ok: true,
        participant,
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof SessionParticipantError) {
      return secureJson(
        { error: err.code },
        { status: PARTICIPANT_STATUS[err.code], headers }
      )
    }
    console.error("[sessions/participants] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
