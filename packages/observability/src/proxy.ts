import { NextResponse, type NextRequest } from "next/server"
import { buildCspHeader } from "./csp"
import {
  correlationIdHeader,
  generateCorrelationId,
  withCorrelationId,
} from "./correlation"

/**
 * Composable proxy wrapper: adds secure headers + correlation ID on
 * every response. Drop it into `src/proxy.ts` via:
 *
 *   export default withHeaders(withAuth(intl));
 *
 * See docs/eleva-v3/implementation-sprints.md "Next.js 16 Naming
 * Conventions" \u2014 this helper is part of the ceiling that keeps
 * each app's src/proxy.ts under 50 LOC.
 */

export type ProxyHandler = (
  req: NextRequest
  // next-intl's middleware has a richer signature; we keep this loose.
) => NextResponse | Promise<NextResponse> | Response | Promise<Response>

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

  return async (req) => {
    const cspValue = options.csp ?? buildCspHeader()
    const incoming = req.headers.get(correlationHeader)
    const correlationId = incoming ?? generateCorrelationId()

    const res = await withCorrelationId(correlationId, async () => handler(req))

    // Build a NextResponse we can mutate regardless of handler return type.
    const nextRes = res instanceof NextResponse ? res : NextResponse.next(res)

    nextRes.headers.set(correlationHeader, correlationId)
    for (const [k, v] of Object.entries(DEFAULT_HEADERS)) {
      nextRes.headers.set(k, v)
    }
    // #region agent log — CSP disabled in dev to test hydration (hypothesis F)
    const _skipCsp = process.env.NODE_ENV === "development"
    // #endregion
    if (options.emitCsp !== false && !_skipCsp) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "005272",
          },
          body: JSON.stringify({
            sessionId: "005272",
            location: "observability/proxy.ts:csp-value",
            message: "CSP header value",
            data: { pathname: req.nextUrl.pathname, csp: cspValue },
            timestamp: Date.now(),
            hypothesisId: "F",
          }),
        }
      ).catch(() => {})
      // #endregion
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
