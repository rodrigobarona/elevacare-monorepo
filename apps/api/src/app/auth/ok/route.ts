import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const rateLimited = await applyRateLimit(
    rateLimitKey(request),
    RATE_LIMITS.public
  )
  if (rateLimited) return rateLimited

  return secureJson(
    { ok: true, service: "better-auth" },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
