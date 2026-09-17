import {
  ListPlatformFeeInvoicesQuerySchema,
  ListPlatformFeeInvoicesResponseSchema,
} from "@eleva/api-client"
import { isSaftExportError, listPlatformFeeInvoices } from "@eleva/accounting"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
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

/**
 * GET /invoicing/platform-fee
 *
 * Staff read of Eleva → expert platform-fee invoice rows. Does not POST
 * TOConline v1 sales documents and does not Comunicar série.
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "accounting:reconcile")
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
  const query = ListPlatformFeeInvoicesQuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  })
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await listPlatformFeeInvoices(query.data)
    return secureJson(ListPlatformFeeInvoicesResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (isSaftExportError(err)) {
      return secureJson(
        { error: "validation", message: err.message },
        { status: 422, headers }
      )
    }
    console.error("[invoicing/platform-fee] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
