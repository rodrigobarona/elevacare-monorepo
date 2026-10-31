import {
  CreateSessionDocumentUploadRequestSchema,
  CreateSessionDocumentUploadResponseSchema,
} from "@eleva/api-client"
import {
  describeError,
  documentUploadPrefix,
  isSessionDocumentPathname,
  recordLogger,
  requireDocumentUploader,
  SESSION_DOCUMENT_UPLOAD,
  SessionDocumentError,
} from "@eleva/records"
import {
  createUploadUrl,
  UploadRejectedError,
} from "@eleva/storage/upload-handler"
import { withPhiScope } from "@eleva/observability"
import { z } from "zod"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { DOCUMENT_STATUS } from "../status"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BookingIdSchema = z.string().uuid()

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const { bookingId: rawBookingId } = await params
  const bookingId = BookingIdSchema.safeParse(rawBookingId)
  if (!bookingId.success) {
    return Response.json(
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

  let booking
  try {
    booking = await requireDocumentUploader({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
    })
  } catch (err) {
    if (err instanceof SessionDocumentError) {
      return Response.json(
        { error: err.code },
        { status: DOCUMENT_STATUS[err.code], headers }
      )
    }
    throw err
  }

  const body = CreateSessionDocumentUploadRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!body.success) {
    return secureJson(
      { error: "invalid_body", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const prefix = documentUploadPrefix({
    orgId: booking.orgId,
    memberUserId: booking.memberUserId,
    id: booking.id,
    actorUserId: session.user.id,
  })
  if (!isSessionDocumentPathname(body.data.pathname, prefix)) {
    return secureJson({ error: "INVALID_PATHNAME" }, { status: 422, headers })
  }

  try {
    const upload = await createUploadUrl({
      store: "private",
      pathname: body.data.pathname,
      contentType: body.data.contentType,
      size: body.data.size,
      allowedContentTypes: SESSION_DOCUMENT_UPLOAD.contentTypes,
      maxBytes: SESSION_DOCUMENT_UPLOAD.maxBytes,
    })
    return secureJson(CreateSessionDocumentUploadResponseSchema.parse(upload), {
      headers,
    })
  } catch (err) {
    if (err instanceof UploadRejectedError) {
      return secureJson(
        { error: "UPLOAD_REJECTED", reason: err.code },
        { status: 422, headers }
      )
    }
    recordLogger.error("documents upload-token failed", {
      bookingId: bookingId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function POST(...args: Parameters<typeof handlePOST>) {
  return withPhiScope(() => handlePOST(...args))
}
