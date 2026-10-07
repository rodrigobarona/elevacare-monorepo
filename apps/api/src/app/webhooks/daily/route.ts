import { DailyWebhookResponseSchema } from "@eleva/api-client"
import {
  dailyWebhookHeaders,
  DailyWebhookAuthError,
  handleDailyWebhook,
} from "@eleva/workflows/video"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "signature",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /webhooks/daily
 *
 * Daily HMAC webhook receiver. Idempotent by event id. Status is
 * monotonic scheduled -> live -> ended | no_show.
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

  const body = await request.text()
  const { timestamp, signature } = dailyWebhookHeaders(request)

  try {
    const result = await handleDailyWebhook({
      timestamp,
      signature,
      body,
    })
    return secureJson(DailyWebhookResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (err instanceof DailyWebhookAuthError) {
      return secureJson(
        { error: "invalid_signature" },
        { status: 401, headers }
      )
    }
    console.error("[webhooks/daily] handler failed", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
