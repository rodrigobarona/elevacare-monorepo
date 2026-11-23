import { logError } from "@eleva/observability"
import { RemoveSessionParticipantResponseSchema } from "@eleva/api-client"
import { z } from "zod"
import {
  removeSessionParticipant,
  SessionParticipantError,
} from "@eleva/workflows/video"
import { afterResponse } from "@/lib/after-response"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { runJobAgain } from "@/lib/run-job-at"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ParticipantParamsSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
})

const PARTICIPANT_STATUS: Record<SessionParticipantError["code"], number> = {
  NOT_ASSIGNED_EXPERT: 403,
  SESSION_NOT_ACTIVE: 410,
  NOT_FOUND: 404,
  ALREADY_PARTICIPANT: 409,
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookingId: string; userId: string }> }
) {
  const headers = corsHeaders(request, "DELETE, OPTIONS")

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

  const parsedParams = ParticipantParamsSchema.safeParse(await params)
  if (!parsedParams.success) {
    return secureJson(
      { error: "validation", issues: parsedParams.error.issues },
      { status: 422, headers }
    )
  }
  const { bookingId, userId } = parsedParams.data

  try {
    const result = await removeSessionParticipant({
      bookingId,
      actorUserId: session.user.id,
      userId,
    })
    if ("ejectionPending" in result) {
      // Removed here, and still in the call: the video service did not
      // take the removal. The job that tries again runs hourly, so a run
      // is asked for soon.
      afterResponse(() => runJobAgain("video-eject-retry", 0))
      return secureJson(
        RemoveSessionParticipantResponseSchema.parse({
          ok: true,
          ejectionPending: true,
        }),
        { status: 202, headers }
      )
    }
    return secureJson(
      RemoveSessionParticipantResponseSchema.parse({ ok: true }),
      { status: 200, headers }
    )
  } catch (err) {
    if (err instanceof SessionParticipantError) {
      return secureJson(
        { error: err.code },
        { status: PARTICIPANT_STATUS[err.code], headers }
      )
    }
    logError("[sessions/participants/delete] unexpected error", err)
    // The removal may be written and the person still in the call (the
    // failure came after). A run that finds nobody to put out costs
    // little; a person left in a session they were removed from does not.
    afterResponse(() => runJobAgain("video-eject-retry", 0))
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "DELETE, OPTIONS"),
  })
}
