import { withPhiScope } from "@eleva/observability"
import { z } from "zod"
import { SummarizeSessionRecordsResponseSchema } from "@eleva/api-client"
import {
  describeError,
  recordLogger,
  requireAssignedExpert,
  SessionRecordError,
  summarizeSessionRecords,
} from "@eleva/records"
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

const BookingIdSchema = z.string().uuid()

const RECORD_STATUS: Record<SessionRecordError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTAKE_READONLY: 409,
  AI_MODEL_ZERO_RETENTION_REQUIRED: 409,
}

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const { bookingId: rawBookingId } = await params
  const bookingId = BookingIdSchema.safeParse(rawBookingId)
  if (!bookingId.success) {
    return secureJson(
      { error: "invalid_body", issues: bookingId.error.issues },
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

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  try {
    await requireAssignedExpert({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
    })
    const record = await summarizeSessionRecords({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
    })
    return secureJson(SummarizeSessionRecordsResponseSchema.parse({ record }), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionRecordError) {
      return secureJson(
        { error: err.code },
        { status: RECORD_STATUS[err.code], headers }
      )
    }
    recordLogger.error("records summarize failed", {
      bookingId: bookingId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export function POST(...args: Parameters<typeof handlePOST>) {
  return withPhiScope(() => handlePOST(...args))
}
