import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"
import { buildCspHeader } from "./csp"
import {
  correlationIdHeader,
  generateCorrelationId,
  withCorrelationId,
} from "./correlation"

/**
 * Standard matcher for app proxies. Excludes Next internals
 * (`_next`, `_vercel`) and any path containing a dot (static assets,
 * images, fonts, etc.).
 *
 * IMPORTANT: Next.js' static analyzer requires the matcher value to
 * be a literal INSIDE each app's `src/proxy.ts`. Do NOT import this
 * constant directly into `config.matcher` -- the build will fail
 * with "matcher needs to be a static string or array of static
 * strings". Inline the literal in each proxy.ts and reference this
 * constant in a comment so the value stays in sync. The constant is
 * exported here for unit tests and documentation only.
 *
 * Canonical literal:
 *   ["/((?!api|_next|_vercel|.*\\..*).*)"]
 */
export const STANDARD_APP_MATCHER: readonly [string] = [
  "/((?!api|_next|_vercel|.*\\..*).*)",
]

/**
 * Matcher for apps that own their own /api route handlers and want
 * those to bypass the proxy entirely (e.g. docs, email).
 *
 * Same inline rule as STANDARD_APP_MATCHER above -- this is a
 * reference/test constant, not an importable matcher.
 *
 * Canonical literal:
 *   ["/((?!api|_next|_vercel|.*\\..*).*)"]
 */
export const PASSTHROUGH_APP_MATCHER: readonly [string] = [
  "/((?!api|_next|_vercel|.*\\..*).*)",
]

export type ProxyHandler = (
  req: NextRequest,
  event?: NextFetchEvent
) => NextResponse | Response | Promise<NextResponse | Response>

/**
 * Tiny pass-through proxy for apps that don't need auth or locale
 * resolution at the edge (docs, email, api). Centralized so they
 * all stay consistent.
 */
export function createPassthroughProxy(): ProxyHandler {
  return () => NextResponse.next()
}

/**
 * Match a pathname against a list of patterns. Each pattern is either
 * an exact pathname (e.g. `/home`) or a single trailing glob
 * (e.g. `/legal/:path*` matches `/legal/privacy`, `/legal/terms`,
 * etc., but NOT `/legalese`).
 */
export function matchesPath(
  pathname: string,
  patterns: readonly string[]
): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith("/:path*")) {
      const prefix = pattern.slice(0, -"/:path*".length)
      if (pathname === prefix || pathname.startsWith(prefix + "/")) return true
    } else if (pathname === pattern) {
      return true
    }
  }
  return false
}

/**
 * Composable proxy wrapper: adds secure headers + correlation ID on
 * every response. Drop it into `src/proxy.ts` via:
 *
 *   export default withHeaders(createAuthProxy({ ... }))
 *
 * See docs/eleva-v3/implementation-sprints.md "Next.js 16 Naming
 * Conventions" -- this helper is part of the ceiling that keeps
 * each app's src/proxy.ts under 50 LOC.
 */

const HSTS = "max-age=63072000; includeSubDomains; preload"

const DEFAULT_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": HSTS,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    'camera=(self "https://*.daily.co"), microphone=(self "https://*.daily.co"), geolocation=(), payment=(self "https://js.stripe.com")',
}

export interface WithHeadersOptions {
  /** Override the default CSP header entirely. */
  csp?: string
  /** Extra headers to merge on top of defaults. */
  extra?: Record<string, string>
  /** If false, suppress CSP for this app (docs/email internal). Default true. */
  emitCsp?: boolean
}

export function withHeaders(
  handler: ProxyHandler,
  options: WithHeadersOptions = {}
): ProxyHandler {
  const correlationHeader = correlationIdHeader()

  return async (req, event) => {
    const cspValue = options.csp ?? buildCspHeader()
    const incoming = req.headers.get(correlationHeader)
    const correlationId = incoming ?? generateCorrelationId()

    const res = await withCorrelationId(correlationId, async () =>
      handler(req, event)
    )

    // Build a NextResponse we can mutate regardless of handler return type.
    const nextRes = res instanceof NextResponse ? res : NextResponse.next(res)

    nextRes.headers.set(correlationHeader, correlationId)
    for (const [k, v] of Object.entries(DEFAULT_HEADERS)) {
      nextRes.headers.set(k, v)
    }
    const skipCsp = process.env.NODE_ENV === "development"
    if (options.emitCsp !== false && !skipCsp) {
      nextRes.headers.set("Content-Security-Policy", cspValue)
    }
    if (options.extra) {
      for (const [k, v] of Object.entries(options.extra)) {
        nextRes.headers.set(k, v)
      }
    }
    return nextRes
  }
}
