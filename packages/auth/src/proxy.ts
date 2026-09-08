import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { resolveGatewayUrl } from "@eleva/config/env"
import { matchesPath, type ProxyHandler } from "@eleva/observability/proxy"
import {
  persistLocaleCookie,
  resolveLocaleForRequest,
} from "@eleva/observability/proxy-locale"
import { LOGIN_PATH } from "./guards"
import { hasDuplicateSessionCookie } from "./server/credentials"

export type { ProxyHandler } from "@eleva/observability/proxy"
export {
  STANDARD_APP_MATCHER,
  PASSTHROUGH_APP_MATCHER,
  createPassthroughProxy,
} from "@eleva/observability/proxy"

export const DEFAULT_UNAUTHENTICATED_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  LOGIN_PATH,
  "/signup",
  "/callback",
  "/logout",
  "/verify-email",
  "/reset-password",
  "/two-factor",
] as const

interface SessionLike {
  user?: { id: string } | null
}

export type RedirectStrategy = "authkit" | { kind: "gateway"; baseUrl: string }

export interface AuthProxyOptions {
  unauthenticatedPaths?: readonly string[]
  authFlowPaths?: readonly string[]
  enforce?: boolean
  redirect?: RedirectStrategy
  onAuthenticated?: (
    req: NextRequest,
    response: NextResponse,
    session: SessionLike
  ) => void
}

function hasOptimisticSession(req: NextRequest): boolean {
  if (hasDuplicateSessionCookie(req.headers.get("cookie"))) return false
  return Boolean(getSessionCookie(req))
}

function buildAuthFlowResponse(req: NextRequest): NextResponse {
  const locale = resolveLocaleForRequest(req)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-eleva-locale", locale)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  persistLocaleCookie(req, response, locale)
  return response
}

function buildGatewayRedirect(req: NextRequest, baseUrl: string): NextResponse {
  const returnTo = encodeURIComponent(req.nextUrl.toString())
  return NextResponse.redirect(`${baseUrl}${LOGIN_PATH}?returnTo=${returnTo}`)
}

export function createAuthProxy(options: AuthProxyOptions = {}): ProxyHandler {
  const unauthenticatedPaths =
    options.unauthenticatedPaths ?? DEFAULT_UNAUTHENTICATED_PATHS
  const authFlowSet = new Set(options.authFlowPaths ?? [])
  const enforce = options.enforce ?? true
  const redirect =
    options.redirect ??
    ({ kind: "gateway", baseUrl: resolveGatewayUrl() } as const)
  const onAuthenticated = options.onAuthenticated

  return async (req) => {
    const pathname = req.nextUrl.pathname

    if (authFlowSet.has(pathname)) {
      return buildAuthFlowResponse(req)
    }

    const signedIn = hasOptimisticSession(req)
    const needsRedirect =
      enforce && !signedIn && !matchesPath(pathname, unauthenticatedPaths)

    if (needsRedirect) {
      if (typeof redirect === "object" && redirect.kind === "gateway") {
        return buildGatewayRedirect(req, redirect.baseUrl)
      }
      const returnTo = encodeURIComponent(req.nextUrl.toString())
      return NextResponse.redirect(
        new URL(`${LOGIN_PATH}?returnTo=${returnTo}`, req.url)
      )
    }

    const locale = resolveLocaleForRequest(req)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("x-eleva-locale", locale)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    persistLocaleCookie(req, response, locale)

    if (signedIn && onAuthenticated) {
      onAuthenticated(req, response, { user: { id: "session" } })
    }

    return response
  }
}
