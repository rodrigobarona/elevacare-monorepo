import {
  GetAccountingReconciliationQuerySchema,
  GetAccountingReconciliationResponseSchema,
} from "@eleva/api-client"
import {
  getAccountingReconciliation,
  isSaftExportError,
} from "@eleva/accounting"
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
 * GET /accounting/reconciliation
 *
 * Staff read of the latest (or requested) Stripe vs expert_invoices
 * reconciliation run. Does not POST TOConline documents.
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
  const query = GetAccountingReconciliationQuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
  })
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const run = await getAccountingReconciliation({ month: query.data.month })
    if (!run) {
      return secureJson({ error: "not found" }, { status: 404, headers })
    }
    return secureJson(
      GetAccountingReconciliationResponseSchema.parse({ run }),
      {
        status: 200,
        headers,
      }
    )
  } catch (err) {
    if (isSaftExportError(err)) {
      return secureJson(
        { error: "validation", message: err.message },
        { status: 422, headers }
      )
    }
    console.error("[accounting/reconciliation] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
