import { corsHeaders } from "@/lib/cors"
import { handleResendWebhook } from "@eleva/notifications"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "signature",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /webhooks/resend
 *
 * Resend delivery events (Svix-signed). Updates notification_deliveries
 * and upserts email_suppressions on hard bounce / complaint.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const rateLimited = await applyRateLimit(
    rateLimitKey(request),
    RATE_LIMITS.webhook,
    headers
  )
  if (rateLimited) return rateLimited

  try {
    const result = await handleResendWebhook(request)
    return secureJson(result.body, { status: result.status, headers })
  } catch (error) {
    console.error("[webhooks/resend] handler failed", error)
    return secureJson(
      { ok: false, error: "internal" },
      { status: 500, headers }
    )
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
