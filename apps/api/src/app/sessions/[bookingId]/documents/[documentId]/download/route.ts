import {
  loadSessionDocumentForDownload,
  SessionDocumentError,
  verifyDocumentUrlGrant,
} from "@eleva/records"
import { getPrivateDocument } from "@eleva/storage"
import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { DOCUMENT_STATUS } from "../../status"

export const ROUTE_POLICY = {
  auth: "signature",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const IdSchema = z.string().uuid()

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "document"
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string; documentId: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const publicLimited = await applyRateLimit(
    rateLimitKey(request),
    RATE_LIMITS.public,
    headers
  )
  if (publicLimited) return publicLimited

  const raw = await params
  const bookingId = IdSchema.safeParse(raw.bookingId)
  const documentId = IdSchema.safeParse(raw.documentId)
  if (!bookingId.success || !documentId.success) {
    return Response.json({ error: "invalid_body" }, { status: 422, headers })
  }

  const grant = verifyDocumentUrlGrant(
    new URL(request.url).searchParams.get("g") ?? ""
  )
  if (
    !grant ||
    grant.bookingId !== bookingId.data ||
    grant.documentId !== documentId.data
  ) {
    return Response.json({ error: "GRANT_EXPIRED" }, { status: 410, headers })
  }

  try {
    const doc = await loadSessionDocumentForDownload({
      bookingId: bookingId.data,
      documentId: documentId.data,
      actorUserId: grant.actorUserId,
    })
    const blob = await getPrivateDocument(doc.blobUrl)
    if (!blob) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404, headers })
    }
    const filename = safeFilename(doc.originalName)
    return new Response(blob.stream, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": doc.mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    if (err instanceof SessionDocumentError) {
      return Response.json(
        { error: err.code },
        { status: DOCUMENT_STATUS[err.code], headers }
      )
    }
    console.error("[sessions/documents] download failed", err)
    return Response.json({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
