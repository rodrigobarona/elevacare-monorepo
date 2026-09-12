import { corsHeaders } from "../../../../lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { handleStripeWebhook } from "../handle-webhook"

export const ROUTE_POLICY = {
  auth: "signature",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * POST /webhooks/stripe/connect
 *
 * Connected-account Stripe webhook receiver (`connect: true` endpoint).
 * Verifies against STRIPE_CONNECT_WEBHOOK_SECRET, then the same
 * `processStripeEvent` dispatcher as the platform route.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

export async function POST(request: Request) {
  return handleStripeWebhook(request, {
    secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    source: "connect",
    secretName: "STRIPE_CONNECT_WEBHOOK_SECRET",
  })
}
