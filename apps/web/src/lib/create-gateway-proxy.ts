import { NextResponse, type NextRequest } from "next/server"
import {
  getOrgTypeBySlug,
  orgSlugNeedingTypeLookup,
} from "@eleva/auth/org-routing"
import { resolveDispatch, type GatewayOrigins } from "@eleva/config/dispatch"
import {
  buildAdminRedirect,
  buildLoginRedirect,
  buildRewriteUrl,
  buildRootRedirect,
  isDocumentNavigation,
  resolveOriginsFromEnv,
} from "./gateway-dispatch"

export type IntlMiddleware = (
  request: NextRequest
) => NextResponse | Response | Promise<NextResponse | Response>

export interface GatewayProxyOptions {
  origins?: GatewayOrigins
  sessionCookieName?: string
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
  const sessionCookie =
    options.sessionCookieName ?? process.env.WORKOS_COOKIE_NAME ?? "wos-session"
  const intlMiddleware = options.intlMiddleware

  return async function gatewayProxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const hasSession = request.cookies.has(sessionCookie)

    let decision = resolveDispatch(pathname, hasSession, origins)

    if (
      hasSession &&
      decision.kind === "rewrite" &&
      decision.origin === origins.app
    ) {
      const slug = orgSlugNeedingTypeLookup(pathname)
      if (slug) {
        const orgType = await getOrgTypeBySlug(slug)
        if (orgType === "expert") {
          decision = { kind: "rewrite", origin: origins.expert }
        }
      }
    }

    if (decision.kind === "rewrite") {
      return rewriteToOrigin(request, decision.origin)
    }

    if (decision.kind === "unauth-slug") {
      return buildLoginRedirect(request)
    }

    if (decision.kind === "admin-redirect") {
      return buildAdminRedirect(request)
    }

    if (pathname === "/" && hasSession && isDocumentNavigation(request)) {
      return buildRootRedirect(request)
    }

    return intlMiddleware(request)
  }
}
