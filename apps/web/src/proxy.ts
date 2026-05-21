import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { isRootPath, resolveDispatch } from "@eleva/config/dispatch"
import { routing } from "./i18n/routing"
import {
  buildLoginRedirect,
  buildRewriteUrl,
  buildRootRedirect,
  resolveOriginsFromEnv,
} from "./lib/gateway-dispatch"

const intlMiddleware = createMiddleware(routing)
const origins = resolveOriginsFromEnv()
const SESSION_COOKIE = process.env.WORKOS_COOKIE_NAME || "wos-session"

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  const decision = resolveDispatch(pathname, hasSession, origins)

  if (decision.kind === "rewrite") {
    const destination = buildRewriteUrl(request, decision.origin)
    return NextResponse.rewrite(destination)
  }

  if (decision.kind === "unauth-slug") {
    return buildLoginRedirect(request)
  }

  if (isRootPath(pathname) && hasSession) {
    return buildRootRedirect(request)
  }

  return intlMiddleware(request)
}

// Custom matcher: the gateway also fronts a /trpc path on this app
// (handled by Next's filesystem, not this proxy), so we exclude it.
// Satellite apps use STANDARD_APP_MATCHER from @eleva/observability/proxy.
export const config = {
  matcher:
    "/((?!api|trpc|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|manifest|robots|sitemap|.*\\..*).*)",
}
