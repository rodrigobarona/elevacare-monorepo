import createMiddleware from "next-intl/middleware"
import { createGatewayProxy } from "./lib/create-gateway-proxy"
import { routing } from "./i18n/routing"

export default createGatewayProxy({
  intlMiddleware: createMiddleware(routing),
})

// Custom matcher: the gateway also fronts a /trpc path on this app
// (handled by Next's filesystem, not this proxy), so we exclude it.
// Satellite apps use STANDARD_APP_MATCHER from @eleva/observability/proxy.
export const config = {
  matcher:
    "/((?!api|trpc|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|manifest|robots|sitemap|.*\\..*).*)",
}
