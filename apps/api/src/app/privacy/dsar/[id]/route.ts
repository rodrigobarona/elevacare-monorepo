import { DsarRequestStatusResponseSchema } from "@eleva/api-client"
import {
  dsarDownloadUrlIfReady,
  getDsarRequestForUser,
  markDsarExpired,
} from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function apiBaseUrl(request: Request): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    new URL(request.url).origin
  ).replace(/\/+$/, "")
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const { id } = await params

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

  const row = await getDsarRequestForUser(session.user.id, id)
  if (!row) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }

  let status = row.status
  if (
    row.status === "ready" &&
    row.expiresAt &&
    row.expiresAt.getTime() <= Date.now()
  ) {
    await markDsarExpired({
      userId: session.user.id,
      orgId: session.orgId,
      dsarId: row.id,
    })
    status = "expired"
  }

  const downloadUrl =
    status === "ready"
      ? dsarDownloadUrlIfReady({
          apiBaseUrl: apiBaseUrl(request),
          request: { ...row, status },
        })
      : undefined

  return secureJson(
    DsarRequestStatusResponseSchema.parse({
      id: row.id,
      status,
      requestedAt: row.requestedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      ...(downloadUrl ? { downloadUrl } : {}),
    }),
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
