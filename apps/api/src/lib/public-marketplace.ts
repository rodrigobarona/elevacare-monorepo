import { corsHeaders } from "@/lib/cors"
import {
  applyRateLimit,
  rateLimitKey,
  RATE_LIMITS,
  trustedSsrClientIp,
} from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { createServerTiming, type ServerTiming } from "@/lib/server-timing"

export const PUBLIC_NOT_FOUND = { error: "not_found" } as const

export async function handlePublicGet(
  request: Request,
  handler: (
    headers: Record<string, string>,
    timing: ServerTiming
  ) => Promise<Response>
): Promise<Response> {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const timing = createServerTiming()
  const ssrClientIp = trustedSsrClientIp(request)
  const rateLimited = await timing.time("ratelimit", () =>
    ssrClientIp
      ? applyRateLimit(`ip:${ssrClientIp}`, RATE_LIMITS.publicSsr, headers)
      : applyRateLimit(rateLimitKey(request), RATE_LIMITS.public, headers)
  )
  if (rateLimited) return timing.apply(rateLimited)
  try {
    return timing.apply(await handler(headers, timing))
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
