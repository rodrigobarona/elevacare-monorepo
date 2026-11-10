import createMiddleware from "next-intl/middleware"
import { withHeaders } from "@eleva/observability/proxy"
import { createGatewayProxy } from "./lib/create-gateway-proxy"
import { routing } from "./i18n/routing"

// Secure headers + CSP on pages this app serves. Requests rewritten to
// another zone keep that zone's own headers.
export default withHeaders(
  createGatewayProxy({
    intlMiddleware: createMiddleware(routing),
  }),
  { skipCrossOriginRewrites: true }
)

// Custom matcher: the gateway also fronts a /trpc path on this app
// (handled by Next's filesystem, not this proxy), so we exclude it.
// Satellite apps use STANDARD_APP_MATCHER from @eleva/observability/proxy.
//
// The help center (basePath /docs) serves its own files under /docs:
// /docs/_next/… CSS and JS, /docs/help-search-index.json, /docs/llms.txt.
// The first pattern skips paths with a dot, so the second sends every
// /docs path to the proxy, which rewrites it to the docs zone.
export const config = {
  matcher: [
    "/((?!api|trpc|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|manifest|robots|sitemap|.*\\..*).*)",
    "/docs/:path*",
  ],
}
