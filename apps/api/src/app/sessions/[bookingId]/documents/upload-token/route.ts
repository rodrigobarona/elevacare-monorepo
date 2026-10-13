import {
  documentUploadPrefix,
  isSessionDocumentPathname,
  requireDocumentUploader,
  SessionDocumentError,
} from "@eleva/records"
import { handleBlobUpload } from "@eleva/storage/blob-upload-handler"
import { z } from "zod"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { DOCUMENT_STATUS } from "../status"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BookingIdSchema = z.string().uuid()

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(
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

  const prefix = documentUploadPrefix({
    orgId: booking.orgId,
    memberUserId: booking.memberUserId,
    id: booking.id,
    actorUserId: session.user.id,
  })

  try {
    return await handleBlobUpload({
      request,
      responseHeaders: headers,
      store: "private",
      allowedContentTypes: ALLOWED_TYPES,
      authorize: (pathname) => {
        if (!isSessionDocumentPathname(pathname, prefix)) {
          throw new Error("invalid-pathname")
        }
        return {
          userId: session.user.id,
          kind: "session_document",
          allowedContentTypes: ALLOWED_TYPES,
        }
      },
    })
  } catch (err) {
    console.error("[sessions/documents/upload-token] failed", err)
    return Response.json({ error: "upload-rejected" }, { status: 400, headers })
  }
}
