import { DisconnectAccountingResponseSchema } from "@eleva/api-client"
import { disconnectExpertInvoicing } from "@eleva/accounting"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { checkBot } from "@/lib/bot-protection"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /accounting/disconnect
 *
 * Disconnects the expert's invoicing provider: deletes the stored
 * credentials and returns invoicing setup to `not_started`. Issued
 * documents and invoice rows are untouched.
 */
export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:invoicing_manage")
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  if (
    session.authMode !== "bearer" &&
    session.authMode !== "jwt" &&
    session.authMode !== "api-key"
  ) {
    const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
    if (botVerdict?.isBot) {
      return secureJson({ error: "blocked" }, { status: 403, headers })
    }
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  try {
    const result = await disconnectExpertInvoicing({ userId: session.user.id })
    if (!result) {
      return secureJson(
        { error: "not_found", message: "no expert profile" },
        { status: 404, headers }
      )
    }
    return secureJson(DisconnectAccountingResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error("[accounting/disconnect] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
