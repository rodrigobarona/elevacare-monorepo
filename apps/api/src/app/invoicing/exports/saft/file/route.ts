import { ExportSaftFileQuerySchema } from "@eleva/api-client"
import { verifySaftDownloadToken } from "@eleva/accounting"
import { getPrivateDocument } from "@eleva/storage"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
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

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:invoicing_manage")
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
  const query = ExportSaftFileQuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
    pathname: url.searchParams.get("pathname") ?? undefined,
    exp: url.searchParams.get("exp") ?? undefined,
    sig: url.searchParams.get("sig") ?? undefined,
  })
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  if (
    !verifySaftDownloadToken({
      orgId: session.orgId,
      month: query.data.month,
      pathname: query.data.pathname,
      exp: query.data.exp,
      signature: query.data.sig,
    })
  ) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }

  let blob: Awaited<ReturnType<typeof getPrivateDocument>>
  try {
    blob = await getPrivateDocument(query.data.pathname)
  } catch (err) {
    console.error("[invoicing/exports/saft/file] storage error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
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
        "Content-Disposition": `attachment; filename="eleva-saft-${query.data.month}.zip"`,
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
