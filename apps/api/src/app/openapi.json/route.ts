import { betterAuthOpenApiDocument } from "@eleva/auth/server/auth"
import { generateOpenApiSpec } from "@/lib/openapi"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

function prefixAuthPaths(
  paths: Record<string, unknown>
): Record<string, unknown> {
  const prefixed: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(paths)) {
    const suffix = path.startsWith("/auth")
      ? path
      : `/auth${path.startsWith("/") ? path : `/${path}`}`
    prefixed[suffix] = value
  }
  return prefixed
}

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
    const spec = generateOpenApiSpec() as {
      paths?: Record<string, unknown>
    }
    try {
      const ba = (await betterAuthOpenApiDocument()) as {
        paths?: Record<string, unknown>
      } | null
      if (ba?.paths) {
        spec.paths = { ...spec.paths, ...prefixAuthPaths(ba.paths) }
      }
    } catch (err) {
      console.warn("[openapi] Better Auth spec merge skipped", err)
    }
    cachedSpec = spec
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
