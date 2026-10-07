import { NextResponse, type NextRequest } from "next/server"
import { requestHasSessionCookie } from "@eleva/auth/credentials"
import {
  getOrgTypeBySlug,
  orgSlugNeedingTypeLookup,
} from "@eleva/auth/org-routing"
import { resolveDispatch, type GatewayOrigins } from "@eleva/config/dispatch"
import { isLocale, rewriteRetiredLocalePath } from "@eleva/config/i18n"
import { rewriteParityPath } from "@eleva/config/public-site-parity"
import {
  buildAdminRedirect,
  buildLoginRedirect,
  buildRewriteUrl,
  resolveOriginsFromEnv,
} from "./gateway-dispatch"

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

    const hasSession = requestHasSessionCookie(request.cookies)

    let decision = resolveDispatch(pathname, hasSession, origins)

    if (
      hasSession &&
      decision.kind === "rewrite" &&
      decision.origin === origins.app
    ) {
      const slug = orgSlugNeedingTypeLookup(pathname)
      if (slug) {
        try {
          const orgType = await getOrgTypeBySlug(slug)
          const isBareSlug = pathname.split("/").filter(Boolean).length === 1
          // Bare /:username is the public marketplace profile — guests and
          // signed-in visitors, including Better Auth anonymous. Expert
          // dashboards live under /:slug/team (or /:slug/~/…), not here.
          if (isBareSlug && (orgType === "expert" || orgType === null)) {
            decision = { kind: "marketing" }
          } else if (orgType === "expert") {
            decision = { kind: "rewrite", origin: origins.expert }
          }
        } catch (err) {
          console.error("[gateway] org type lookup failed", { slug, err })
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

    // Public `/` stays on marketing. Cookie presence is not a login —
    // a leftover or empty session token must not bounce guests to
    // /dashboard and then /login.
    return intlMiddleware(request)
  }
}
