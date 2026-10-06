import { z } from "zod"
import { IssuePlatformFeeInvoiceResponseSchema } from "@eleva/api-client"
import {
  isPlatformFeeRetryError,
  retryPlatformFeeInvoice,
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

const InvoiceIdSchema = z.string().uuid()

/**
 * POST /invoicing/platform-fee/{id}/retry
 *
 * Staff replay of one platform-fee row through closed-gate classification.
 * Never POSTs TOConline v1 sales documents and never Comunica série.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

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

  const id = InvoiceIdSchema.safeParse((await params).id)
  if (!id.success) {
    return secureJson(
      { error: "validation", issues: id.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const result = await retryPlatformFeeInvoice({
      invoiceId: id.data,
      actorUserId: session.user.id,
    })
    return secureJson(IssuePlatformFeeInvoiceResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (isPlatformFeeRetryError(err)) {
      return secureJson(
        { error: err.code, code: err.code, message: err.message },
        { status: err.status, headers }
      )
    }
    console.error("[invoicing/platform-fee/retry] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
