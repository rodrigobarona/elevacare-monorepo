import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { resolveGatewayUrl } from "@eleva/config/env"
import { matchesPath, type ProxyHandler } from "@eleva/observability/proxy"
import {
  persistLocaleCookie,
  resolveLocaleForRequest,
} from "@eleva/observability/proxy-locale"
import { LOGIN_PATH } from "./guards"
import {
  expiredSessionCookies,
  hasDuplicateSessionCookie,
} from "./server/credentials"

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

export type RedirectStrategy = { kind: "gateway"; baseUrl: string }
export type OptimisticSessionState = "signed-in" | "signed-out" | "ambiguous"

export interface AuthProxyOptions {
  unauthenticatedPaths?: readonly string[]
  authFlowPaths?: readonly string[]
  enforce?: boolean
  redirect?: RedirectStrategy
  onAuthenticated?: (req: NextRequest, response: NextResponse) => void
}

export function optimisticSessionState(
  req: NextRequest
): OptimisticSessionState {
  if (hasDuplicateSessionCookie(req.headers.get("cookie"))) return "ambiguous"
  return getSessionCookie(req) ? "signed-in" : "signed-out"
}

export function applyExpiredSessionCookies(response: NextResponse): void {
  for (const cookie of expiredSessionCookies()) {
    response.headers.append("Set-Cookie", cookie)
  }
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

    const sessionState = optimisticSessionState(req)
    const signedIn = sessionState === "signed-in"
    const needsRedirect =
      enforce && !signedIn && !matchesPath(pathname, unauthenticatedPaths)

    if (needsRedirect) {
      const response = buildGatewayRedirect(req, redirect.baseUrl)
      if (sessionState === "ambiguous") applyExpiredSessionCookies(response)
      return response
    }

    const locale = resolveLocaleForRequest(req)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("x-eleva-locale", locale)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    persistLocaleCookie(req, response, locale)

    if (sessionState === "ambiguous") applyExpiredSessionCookies(response)

    if (signedIn && onAuthenticated) {
      onAuthenticated(req, response)
    }

    return response
  }
}
