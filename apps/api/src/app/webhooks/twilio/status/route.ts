import { corsHeaders } from "@/lib/cors"
import { handleTwilioStatusWebhook } from "@eleva/notifications"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "signature",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /webhooks/twilio/status?deliveryId=<rowId>
 *
 * Twilio StatusCallback. Validates X-Twilio-Signature against the exact
 * request URL (query included) and the form body as received.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const result = await handleTwilioStatusWebhook(request)
  return secureJson(result.body, { status: result.status, headers })
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
