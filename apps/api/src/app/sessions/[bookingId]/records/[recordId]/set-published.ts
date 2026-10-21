import { PublishSessionRecordResponseSchema } from "@eleva/api-client"
import {
  describeError,
  recordLogger,
  SessionRecordError,
  setSessionRecordPublished,
} from "@eleva/records"
import { z } from "zod"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { rejectUnexpectedBody } from "@/lib/empty-body"

const RECORD_STATUS: Record<SessionRecordError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTAKE_READONLY: 409,
  NOT_PUBLISHABLE: 409,
  AI_MODEL_ZERO_RETENTION_REQUIRED: 409,
  AI_MODEL_NOT_APPROVED: 409,
  AI_CONSENT_REQUIRED: 403,
}

const IdSchema = z.string().uuid()

export async function handleSetPublished(
  request: Request,
  params: Promise<{ bookingId: string; recordId: string }>,
  published: boolean
) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const raw = await params
  const bookingId = IdSchema.safeParse(raw.bookingId)
  const recordId = IdSchema.safeParse(raw.recordId)
  if (!bookingId.success || !recordId.success) {
    return secureJson(
      { error: "invalid_body", issues: [] },
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

  const unexpectedBody = await rejectUnexpectedBody(request, headers)
  if (unexpectedBody) return unexpectedBody

  try {
    const record = await setSessionRecordPublished({
      bookingId: bookingId.data,
      recordId: recordId.data,
      actorUserId: session.user.id,
      published,
    })
    return secureJson(PublishSessionRecordResponseSchema.parse(record), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionRecordError) {
      return secureJson(
        { error: err.code },
        { status: RECORD_STATUS[err.code], headers }
      )
    }
    recordLogger.error(published ? "publish failed" : "unpublish failed", {
      bookingId: bookingId.data,
      recordId: recordId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function publishOptions(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
