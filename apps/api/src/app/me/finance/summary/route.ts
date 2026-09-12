import { FinanceSummaryResponseSchema } from "@eleva/api-client"
import { financeSummary, listFinanceBookings } from "@eleva/billing/server"
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

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "payouts:view_own")
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const [summary, bookings] = await Promise.all([
    financeSummary(session.orgId),
    listFinanceBookings(session.orgId),
  ])

  return secureJson(FinanceSummaryResponseSchema.parse({ summary, bookings }), {
    status: 200,
    headers,
  })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
