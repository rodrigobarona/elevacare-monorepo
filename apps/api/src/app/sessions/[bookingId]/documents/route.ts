import {
  CompleteSessionDocumentRequestSchema,
  CompleteSessionDocumentResponseSchema,
  ListSessionDocumentsResponseSchema,
} from "@eleva/api-client"
import {
  completeSessionDocument,
  describeError,
  documentUploadPrefix,
  isSessionDocumentPathname,
  listSessionDocuments,
  recordLogger,
  requireDocumentUploader,
  SESSION_DOCUMENT_UPLOAD,
  SessionDocumentError,
} from "@eleva/records"
import {
  UploadRejectedError,
  verifyUpload,
} from "@eleva/storage/upload-handler"
import { withPhiScope } from "@eleva/observability"
import { z } from "zod"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { DOCUMENT_STATUS } from "./status"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BookingIdSchema = z.string().uuid()

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
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
    const documents = await listSessionDocuments({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
    })
    return secureJson(ListSessionDocumentsResponseSchema.parse({ documents }), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionDocumentError) {
      return secureJson(
        { error: err.code },
        { status: DOCUMENT_STATUS[err.code], headers }
      )
    }
    recordLogger.error("documents list failed", {
      bookingId: bookingId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
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

  const parsed = CompleteSessionDocumentRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return secureJson(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const booking = await requireDocumentUploader({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
    })
    const prefix = documentUploadPrefix({
      ...booking,
      actorUserId: session.user.id,
    })
    if (!isSessionDocumentPathname(parsed.data.pathname, prefix)) {
      return secureJson({ error: "INVALID_PATHNAME" }, { status: 422, headers })
    }
    const uploaded = await verifyUpload({
      store: "private",
      pathname: parsed.data.pathname,
      allowedContentTypes: SESSION_DOCUMENT_UPLOAD.contentTypes,
      maxBytes: SESSION_DOCUMENT_UPLOAD.maxBytes,
    })
    const document = await completeSessionDocument({
      bookingId: bookingId.data,
      actorUserId: session.user.id,
      pathname: uploaded.pathname,
      mime: uploaded.contentType,
      sizeBytes: uploaded.size,
      scope: parsed.data.scope,
      originalName: parsed.data.originalName,
    })
    return secureJson(CompleteSessionDocumentResponseSchema.parse(document), {
      headers,
    })
  } catch (err) {
    if (err instanceof UploadRejectedError) {
      return secureJson(
        err.code === "not-found"
          ? { error: "INVALID_PATHNAME" }
          : { error: "UPLOAD_REJECTED", reason: err.code },
        { status: 422, headers }
      )
    }
    if (err instanceof SessionDocumentError) {
      return secureJson(
        { error: err.code },
        { status: DOCUMENT_STATUS[err.code], headers }
      )
    }
    recordLogger.error("documents complete failed", {
      bookingId: bookingId.data,
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
