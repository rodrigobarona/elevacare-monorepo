import { SessionDocumentUrlResponseSchema } from "@eleva/api-client"
import {
  describeError,
  mintSessionDocumentUrl,
  recordLogger,
  SessionDocumentError,
} from "@eleva/records"
import { withPhiScope } from "@eleva/observability"
import { z } from "zod"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"
import { DOCUMENT_STATUS } from "../../status"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const IdSchema = z.string().uuid()

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string; documentId: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const raw = await params
  const bookingId = IdSchema.safeParse(raw.bookingId)
  const documentId = IdSchema.safeParse(raw.documentId)
  if (!bookingId.success || !documentId.success) {
    return secureJson({ error: "invalid_body" }, { status: 422, headers })
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
    const result = await mintSessionDocumentUrl({
      bookingId: bookingId.data,
      documentId: documentId.data,
      actorUserId: session.user.id,
      apiBase: new URL(request.url).origin,
    })
    return secureJson(SessionDocumentUrlResponseSchema.parse(result), {
      headers,
    })
  } catch (err) {
    if (err instanceof SessionDocumentError) {
      return secureJson(
        { error: err.code },
        { status: DOCUMENT_STATUS[err.code], headers }
      )
    }
    recordLogger.error("documents url failed", {
      bookingId: bookingId.data,
      documentId: documentId.data,
      status: describeError(err),
    })
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}

export function GET(...args: Parameters<typeof handleGET>) {
  return withPhiScope(() => handleGET(...args))
}
