import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export const PUBLIC_NOT_FOUND = { error: "not_found" } as const

export async function handlePublicGet(
  request: Request,
  handler: (headers: Record<string, string>) => Promise<Response>
): Promise<Response> {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const rateLimited = await applyRateLimit(
    rateLimitKey(request),
    RATE_LIMITS.public,
    headers
  )
  if (rateLimited) return rateLimited
  try {
    return await handler(headers)
  } catch (err) {
    console.error("public route failure", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export function publicOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}

export function isIanaTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}
