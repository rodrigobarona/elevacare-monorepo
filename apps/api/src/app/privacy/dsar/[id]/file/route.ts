import { getPrivateDocument } from "@eleva/storage"
import {
  getDsarRequestForUser,
  verifyDsarDownloadToken,
} from "@eleva/compliance"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson, withSecurityHeaders } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

  const url = new URL(request.url)
  const exp = Number(url.searchParams.get("exp"))
  const sig = url.searchParams.get("sig") ?? ""
  if (!verifyDsarDownloadToken(id, exp, sig)) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }

  const row = await getDsarRequestForUser(session.user.id, id)
  if (
    !row ||
    row.status !== "ready" ||
    !row.blobPathname ||
    !row.expiresAt ||
    row.expiresAt.getTime() <= Date.now()
  ) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }

  let blob: Awaited<ReturnType<typeof getPrivateDocument>>
  try {
    blob = await getPrivateDocument(row.blobPathname)
  } catch {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }
  if (!blob?.stream) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }

  return withSecurityHeaders(
    new Response(blob.stream, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="eleva-member-export.zip"',
      },
    }),
    { noStore: true }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
