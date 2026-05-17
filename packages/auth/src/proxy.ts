import { NextResponse, type NextRequest } from "next/server"
import {
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"
import { matchesPath, type ProxyHandler } from "@eleva/observability/proxy"
import {
  persistLocaleCookie,
  resolveLocaleForRequest,
} from "@eleva/observability/proxy-locale"

/**
 * Single source of truth for every Eleva app proxy.
 *
 * Compose with the secure-headers wrapper from @eleva/observability:
 *
 *   // satellite app (admin / expert / team / academy)
 *   export default withHeaders(
 *     createAuthProxy({
 *       redirect: { kind: "gateway", baseUrl: resolveGatewayUrl() },
 *     })
 *   )
 *
 *   // member app with org-slug tracking
 *   export default withHeaders(
 *     createAuthProxy({
 *       unauthenticatedPaths: [...],
 *       onAuthenticated: trackLastActiveOrg,
 *     })
 *   )
 *
 *   // account app, with auth-flow routes that drive WorkOS themselves
 *   export default withHeaders(
 *     createAuthProxy({
 *       authFlowPaths: ["/signin", "/signup", "/callback", "/logout"],
 *       unauthenticatedPaths: [],
 *     })
 *   )
 *
 * The factory handles, in order, on every request:
 *   1. Short-circuit `authkit()` for declared auth-flow paths
 *      (saves ~50-200ms by skipping cookie decryption + token refresh).
 *   2. `authkit(req)` to resolve session + AuthKit headers.
 *   3. Redirect unauthenticated users on protected paths -- via either
 *      AuthKit's authorizationUrl (default) OR the gateway /signin URL
 *      (for satellite apps that prefer to bounce through eleva.care).
 *   4. Resolve + propagate ELEVA_LOCALE to request headers and cookie.
 *   5. Invoke optional onAuthenticated hook (cookie writes, etc.).
 *   6. Re-apply AuthKit response headers via applyResponseHeaders.
 */

export type { ProxyHandler } from "@eleva/observability/proxy"
// Re-exported here so callers only need one import for the matcher
// + factory pair. Single source of truth lives in observability/proxy.
export {
  STANDARD_APP_MATCHER,
  PASSTHROUGH_APP_MATCHER,
  createPassthroughProxy,
} from "@eleva/observability/proxy"

/**
 * Default unauth allowlist for protected apps. Apps can override.
 * Includes the WorkOS auth-flow paths so that even with `enforce: true`
 * the proxy does not redirect a signin attempt to itself.
 */
export const DEFAULT_UNAUTHENTICATED_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  "/signin",
  "/signup",
  "/callback",
  "/logout",
] as const

interface SessionLike {
  user?: { id: string } | null
}

export type RedirectStrategy = "authkit" | { kind: "gateway"; baseUrl: string }

export interface AuthProxyOptions {
  /**
   * Paths allowed without a session. AuthKit still runs so server
   * components keep their middleware headers, but no redirect is
   * issued. Supports a single trailing `/:path*` glob.
   */
  unauthenticatedPaths?: readonly string[]

  /**
   * Paths that drive their own WorkOS interaction inside route
   * handlers (e.g. /signin, /signup, /callback, /logout). These skip
   * `authkit()` entirely, avoiding wasted cookie decryption work.
   */
  authFlowPaths?: readonly string[]

  /** Whether to enforce auth at the proxy layer. Default true. */
  enforce?: boolean

  /**
   * How to bounce unauthenticated users to the sign-in screen.
   *   - "authkit" (default): redirect to the AuthKit authorizationUrl
   *     using handleAuthkitHeaders (preserves PKCE cookies + headers).
   *   - { kind: "gateway", baseUrl }: redirect to
   *     `${baseUrl}/signin?returnTo=...` -- used by satellite apps
   *     so the gateway can drive the WorkOS handshake centrally.
   */
  redirect?: RedirectStrategy

  /**
   * Optional hook for authenticated requests. Runs after locale is
   * persisted, before AuthKit response headers are applied. Use it
   * for app-specific cookies like "last active org".
   */
  onAuthenticated?: (
    req: NextRequest,
    response: NextResponse,
    session: SessionLike
  ) => void
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
  return NextResponse.redirect(`${baseUrl}/signin?returnTo=${returnTo}`)
}

export function createAuthProxy(options: AuthProxyOptions = {}): ProxyHandler {
  const unauthenticatedPaths =
    options.unauthenticatedPaths ?? DEFAULT_UNAUTHENTICATED_PATHS
  const authFlowSet = new Set(options.authFlowPaths ?? [])
  const enforce = options.enforce ?? true
  const redirect = options.redirect ?? "authkit"
  const onAuthenticated = options.onAuthenticated

  return async (req) => {
    const pathname = req.nextUrl.pathname

    if (authFlowSet.has(pathname)) {
      return buildAuthFlowResponse(req)
    }

    const { session, headers, authorizationUrl } = await authkit(req)

    const needsRedirect =
      enforce &&
      !session.user &&
      authorizationUrl &&
      !matchesPath(pathname, unauthenticatedPaths)

    if (needsRedirect) {
      if (typeof redirect === "object" && redirect.kind === "gateway") {
        return buildGatewayRedirect(req, redirect.baseUrl)
      }
      return handleAuthkitHeaders(req, headers, {
        redirect: authorizationUrl,
      })
    }

    const locale = resolveLocaleForRequest(req)
    const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
      req,
      headers
    )
    requestHeaders.set("x-eleva-locale", locale)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    persistLocaleCookie(req, response, locale)

    if (session.user && onAuthenticated) {
      onAuthenticated(req, response, session as SessionLike)
    }

    return applyResponseHeaders(response, responseHeaders)
  }
}
