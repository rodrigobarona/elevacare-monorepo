import { withPhiScope } from "@eleva/observability"
import { z } from "zod"
import {
  SessionReportDraftRequestSchema,
  SessionReportDraftResponseSchema,
  SessionReportDraftStatusResponseSchema,
} from "@eleva/api-client"
import { getFlag } from "@eleva/flags"
import {
  describeError,
  draftSessionReport,
  getSessionReportDraftStatus,
  recordLogger,
  requireAssignedExpert,
  SessionRecordError,
} from "@eleva/records"
import { getExpertProfileForOrg } from "@eleva/db"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BookingIdQuerySchema = z.object({
  bookingId: z.string().uuid(),
})

const RECORD_STATUS: Record<SessionRecordError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTAKE_READONLY: 409,
  NOT_PUBLISHABLE: 409,
  AI_MODEL_ZERO_RETENTION_REQUIRED: 409,
  AI_MODEL_NOT_APPROVED: 409,
  AI_CONSENT_REQUIRED: 403,
  FEATURE_DISABLED: 403,
}

async function requireAiReportsBeta(): Promise<Response | null> {
  if (await getFlag("ff.ai_reports_beta")) return null
  return secureJson(
    {
      error: "feature_disabled",
      message: "AI session reports are not enabled for this environment.",
    },
    { status: 403 }
  )
}

/**
 * The caller must be the booking's expert, acting in the booking's own
 * workspace. The per-org AI bucket and the audit trail then follow the
 * booking's org, so switching workspace cannot open a fresh bucket for the
 * same clinic's bookings. Returns the rate-limit response when throttled;
 * throws `SessionRecordError` when the booking is not the caller's here.
 */
async function requireBookingInWorkspace(input: {
  bookingId: string
  actorUserId: string
  orgId: string
  headers: Record<string, string>
}): Promise<Response | null> {
  // A cheap per-user limit first, so unknown or foreign booking ids are
  // throttled too (they throw before the per-org AI bucket below).
  const callerLimited = await applyRateLimit(
    `user:${input.actorUserId}`,
    RATE_LIMITS.authenticated,
    input.headers
  )
  if (callerLimited) return callerLimited
  const booking = await requireAssignedExpert({
    bookingId: input.bookingId,
    actorUserId: input.actorUserId,
  })
  if (booking.orgId !== input.orgId) {
    throw new SessionRecordError("FORBIDDEN")
  }
  return applyRateLimit(
    `org:${booking.orgId}`,
    RATE_LIMITS.sessionReportAi,
    input.headers
  )
}

async function handleGET(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
  const disabled = await requireAiReportsBeta()
  if (disabled) return disabled

  const url = new URL(request.url)
  const parsedQuery = BookingIdQuerySchema.safeParse({
    bookingId: url.searchParams.get("bookingId"),
  })
  if (!parsedQuery.success) {
    return secureJson(
      { error: "validation", issues: parsedQuery.error.issues },
      { status: 422, headers }
    )
  }

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  try {
    const rateLimited = await requireBookingInWorkspace({
      bookingId: parsedQuery.data.bookingId,
      actorUserId: session.user.id,
      orgId: profile.orgId,
      headers,
    })
    if (rateLimited) return rateLimited
    const status = await getSessionReportDraftStatus({
      bookingId: parsedQuery.data.bookingId,
      actorUserId: session.user.id,
    })
    return secureJson(SessionReportDraftStatusResponseSchema.parse(status), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionRecordError) {
      return secureJson(
        { error: err.code },
        { status: RECORD_STATUS[err.code], headers }
      )
    }
    recordLogger.error("ai session-report status failed", {
      bookingId: parsedQuery.data.bookingId,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

async function handlePOST(request: Request) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
  const disabled = await requireAiReportsBeta()
  if (disabled) return disabled

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const body = SessionReportDraftRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const rateLimited = await requireBookingInWorkspace({
      bookingId: body.data.bookingId,
      actorUserId: session.user.id,
      orgId: profile.orgId,
      headers,
    })
    if (rateLimited) return rateLimited
    const record = await draftSessionReport({
      bookingId: body.data.bookingId,
      actorUserId: session.user.id,
      noteRecordIds: body.data.noteRecordIds,
    })
    return secureJson(SessionReportDraftResponseSchema.parse({ record }), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionRecordError) {
      return secureJson(
        { error: err.code },
        { status: RECORD_STATUS[err.code], headers }
      )
    }
    recordLogger.error("ai session-report draft failed", {
      bookingId: body.data.bookingId,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, POST, OPTIONS"),
  })
}

export function GET(...args: Parameters<typeof handleGET>) {
  return withPhiScope(() => handleGET(...args))
}

export function POST(...args: Parameters<typeof handlePOST>) {
  return withPhiScope(() => handlePOST(...args))
}
