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
  const cspValue = options.csp ?? buildCspHeader()
  const correlationHeader = correlationIdHeader()

  return async (req) => {
    const incoming = req.headers.get(correlationHeader)
    const correlationId = incoming ?? generateCorrelationId()

    const res = await withCorrelationId(correlationId, async () => handler(req))

    // Build a NextResponse we can mutate regardless of handler return type.
    const nextRes = res instanceof NextResponse ? res : NextResponse.next(res)

    nextRes.headers.set(correlationHeader, correlationId)
    for (const [k, v] of Object.entries(DEFAULT_HEADERS)) {
      nextRes.headers.set(k, v)
    }
    if (options.emitCsp !== false) {
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
