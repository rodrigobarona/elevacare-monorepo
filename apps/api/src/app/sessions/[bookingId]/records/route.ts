import { registerPhi, withPhiScope } from "@eleva/observability"
import { z } from "zod"
import {
  ListSessionRecordsResponseSchema,
  UpsertSessionRecordRequestSchema,
  UpsertSessionRecordResponseSchema,
} from "@eleva/api-client"
import {
  describeError,
  listSessionRecords,
  recordLogger,
  SessionRecordError,
  upsertSessionRecord,
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

const RECORD_STATUS: Record<SessionRecordError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTAKE_READONLY: 409,
  NOT_PUBLISHABLE: 409,
  AI_MODEL_ZERO_RETENTION_REQUIRED: 409,
  AI_MODEL_NOT_APPROVED: 409,
  AI_CONSENT_REQUIRED: 403,
}

const BookingIdSchema = z.string().uuid()

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const headers = corsHeaders(request, "GET, PUT, OPTIONS")
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
    const records = await listSessionRecords({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
    })
    return secureJson(ListSessionRecordsResponseSchema.parse({ records }), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionRecordError) {
      return secureJson(
        { error: err.code },
        { status: RECORD_STATUS[err.code], headers }
      )
    }
    recordLogger.error("records list failed", {
      bookingId: bookingId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

async function handlePUT(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const headers = corsHeaders(request, "GET, PUT, OPTIONS")
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

  const parsed = UpsertSessionRecordRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  registerPhi(parsed.data.body)

  try {
    const record = await upsertSessionRecord({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
      kind: parsed.data.kind,
      body: parsed.data.body,
    })
    return secureJson(UpsertSessionRecordResponseSchema.parse(record), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionRecordError) {
      return secureJson(
        { error: err.code },
        { status: RECORD_STATUS[err.code], headers }
      )
    }
    recordLogger.error("records upsert failed", {
      bookingId: bookingId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PUT, OPTIONS"),
  })
}

export function GET(...args: Parameters<typeof handleGET>) {
  return withPhiScope(() => handleGET(...args))
}

export function PUT(...args: Parameters<typeof handlePUT>) {
  return withPhiScope(() => handlePUT(...args))
}
