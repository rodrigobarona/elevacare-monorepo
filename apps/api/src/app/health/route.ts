import type { RoutePolicy } from "@/lib/route-policy"
import { corsHeaders } from "@/lib/cors"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export function GET(request: Request) {
  return secureJson(
    {
      status: "ok",
      service: "eleva-api",
      zone: "/api",
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: corsHeaders(request, "GET, OPTIONS") }
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
