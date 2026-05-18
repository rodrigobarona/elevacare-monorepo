import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { secureJson } from "./security-headers"

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

const limiters = new Map<string, Ratelimit>()

function getLimiter(
  prefix: string,
  maxRequests: number,
  windowMs: number
): Ratelimit | null {
  const r = getRedis()
  if (!r) return null

  const key = `${prefix}:${maxRequests}:${windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      prefix: `rl:${prefix}`,
      analytics: true,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

export interface RateLimitConfig {
  /** Namespace prefix for Redis keys */
  prefix: string
  /** Max requests per window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

export const RATE_LIMITS = {
  authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  public: { prefix: "pub", maxRequests: 10, windowMs: 60_000 },
  onboarding: { prefix: "onboard", maxRequests: 5, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

/**
 * Apply rate limiting. Returns null if allowed, or a Response if blocked.
 * Gracefully degrades (allows request) if Redis is unavailable.
 * Pass `routeHeaders` to merge CORS/security headers into the 429 response.
 */
export async function applyRateLimit(
  identifier: string,
  config: RateLimitConfig,
  routeHeaders?: HeadersInit
): Promise<Response | null> {
  const limiter = getLimiter(config.prefix, config.maxRequests, config.windowMs)
  if (!limiter) return null

  try {
    const result = await limiter.limit(identifier)
    if (!result.success) {
      const retryAfter = Math.max(
        0,
        Math.ceil((result.reset - Date.now()) / 1000)
      )
      return secureJson(
        { error: "rate_limit_exceeded", retryAfter: result.reset },
        {
          status: 429,
          headers: {
            ...Object.fromEntries(
              routeHeaders instanceof Headers
                ? routeHeaders.entries()
                : Object.entries(routeHeaders ?? {})
            ),
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.reset),
          },
        }
      )
    }
  } catch {
    // Redis unavailable -- fail open to avoid blocking legitimate traffic
  }

  return null
}

/**
 * Extract a rate-limit key from the request. Uses userId if
 * authenticated, otherwise falls back to IP.
 */
export function rateLimitKey(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown"
  return `ip:${ip}`
}
