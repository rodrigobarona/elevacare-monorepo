import { NextResponse, type NextRequest } from "next/server"
import { resolveDispatch, type GatewayOrigins } from "@eleva/config/dispatch"
import {
  defaultLocale,
  isLocale,
  normalizeLocale,
  rewriteRetiredLocalePath,
  type Locale,
} from "@eleva/config/i18n"
import { rewriteParityPath } from "@eleva/config/public-site-parity"
import { persistLocaleCookie } from "@eleva/observability/proxy-locale"
import {
  buildAdminRedirect,
  buildRewriteUrl,
  resolveOriginsFromEnv,
} from "./gateway-dispatch"

/**
 * Prefer the URL prefix (what the visitor chose on /es, /pt), then
 * next-intl's resolved locale header, then the default locale.
 */
function resolveMarketingLocale(
  pathname: string,
  response: NextResponse
): Locale {
  const first = pathname.split("/").filter(Boolean)[0]
  if (first && isLocale(first)) return first

  return (
    normalizeLocale(
      response.headers.get("x-middleware-request-x-next-intl-locale")
    ) ??
    normalizeLocale(response.headers.get("x-next-intl-locale")) ??
    defaultLocale
  )
}

function rewriteForOrganizationsPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null
  let prefix = ""
  let rest = segments
  const first = segments[0]
  if (first && isLocale(first) && segments.length > 1) {
    prefix = `/${first}`
    rest = segments.slice(1)
  }
  if (rest.length !== 1 || rest[0]?.toLowerCase() !== "for-organizations") {
    return null
  }
  return `${prefix}/for-clinics`
}

export type IntlMiddleware = (
  request: NextRequest
) => NextResponse | Response | Promise<NextResponse | Response>

export interface GatewayProxyOptions {
  origins?: GatewayOrigins
  intlMiddleware: IntlMiddleware
}

function shouldRedirectToLocalZone(origin: string): boolean {
  if (process.env.NODE_ENV !== "development") return false

  try {
    const url = new URL(origin)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

function rewriteToOrigin(request: NextRequest, origin: string): NextResponse {
  const destination = buildRewriteUrl(request, origin)
  if (shouldRedirectToLocalZone(origin)) {
    return NextResponse.redirect(destination)
  }
  return NextResponse.rewrite(destination)
}

export function createGatewayProxy(options: GatewayProxyOptions) {
  const origins = options.origins ?? resolveOriginsFromEnv()
  const intlMiddleware = options.intlMiddleware

  return async function gatewayProxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const retiredPath = rewriteRetiredLocalePath(pathname)
    if (retiredPath) {
      const destination = request.nextUrl.clone()
      destination.pathname = retiredPath
      return NextResponse.redirect(destination, 301)
    }

    const organizationsPath = rewriteForOrganizationsPath(pathname)
    if (organizationsPath) {
      const destination = request.nextUrl.clone()
      destination.pathname = organizationsPath
      return NextResponse.redirect(destination, 301)
    }

    const parityPath = rewriteParityPath(pathname)
    if (parityPath) {
      const destination = request.nextUrl.clone()
      destination.pathname = parityPath
      return NextResponse.redirect(destination, 301)
    }

    // Routing reads the address only (ADR-026): no session cookie check and
    // no database lookup. `/:username` is always the public profile.
    const decision = resolveDispatch(pathname, origins)

    if (decision.kind === "rewrite") {
      return rewriteToOrigin(request, decision.origin)
    }

    if (decision.kind === "admin-redirect") {
      return buildAdminRedirect(request)
    }

    // Public `/` stays on marketing. Cookie presence is not a login —
    // a leftover or empty session token must not bounce guests to
    // /dashboard and then /login.
    const intlResponse = await intlMiddleware(request)
    const response =
      intlResponse instanceof NextResponse
        ? intlResponse
        : new NextResponse(intlResponse.body, intlResponse)

    persistLocaleCookie(
      request,
      response,
      resolveMarketingLocale(pathname, response)
    )
    return response
  }
}
