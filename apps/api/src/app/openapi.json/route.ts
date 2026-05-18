import { generateOpenApiSpec } from "@/lib/openapi"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

let cachedSpec: unknown = null

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  const rateLimited = await applyRateLimit(
    rateLimitKey(request),
    RATE_LIMITS.public
  )
  if (rateLimited) return rateLimited

  if (!cachedSpec) {
    cachedSpec = generateOpenApiSpec()
  }

  return secureJson(cachedSpec, {
    status: 200,
    headers: {
      ...headers,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
    noStore: false,
  })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
