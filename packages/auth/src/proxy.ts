import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"
import {
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"

/**
 * withAuth proxy wrapper. Composes WorkOS AuthKit's composable API
 * which handles:
 *   - reading/refreshing the WorkOS session cookie (scope=.eleva.care)
 *   - redirecting unauthenticated users to /signin for protected paths
 *   - exposing the session to Server Components via headers
 *
 * Uses the `authkit()` composable function which ALWAYS returns the
 * `x-workos-middleware` header, ensuring server-side `withAuth()` can
 * detect that middleware ran on every route.
 *
 * Usage in apps/app/src/proxy.ts:
 *
 *   export default withHeaders(withAuth(intl));
 */

export type ProxyHandler = (
  req: NextRequest,
  event?: NextFetchEvent
) => NextResponse | Response | Promise<NextResponse | Response>

export interface WithAuthOptions {
  /** Paths the WorkOS proxy should NOT gate. Defaults to the public surface. */
  unauthenticatedPaths?: string[]
  /** Whether AuthKit enforces auth at the proxy layer. */
  enforce?: boolean
}

const DEFAULT_UNAUTH_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  "/signin",
  "/signup",
]

function isUnauthenticatedPath(pathname: string, paths: string[]): boolean {
  for (const pattern of paths) {
    if (pattern.endsWith("/:path*")) {
      const prefix = pattern.slice(0, -"/:path*".length)
      if (pathname === prefix || pathname.startsWith(prefix + "/")) return true
    } else if (pathname === pattern) {
      return true
    }
  }
  return false
}

export function withAuth(
  handler: ProxyHandler,
  options: WithAuthOptions = {}
): ProxyHandler {
  return async (req, event) => {
    // #region agent log
    const _authStart = Date.now()
    // #endregion
    const { session, headers, authorizationUrl } = await authkit(req)

    const enforce = options.enforce ?? true
    if (enforce && !session.user && authorizationUrl) {
      const unauthPaths = options.unauthenticatedPaths ?? DEFAULT_UNAUTH_PATHS
      if (!isUnauthenticatedPath(req.nextUrl.pathname, unauthPaths)) {
        return handleAuthkitHeaders(req, headers, {
          redirect: authorizationUrl,
        })
      }
    }

    // #region agent log
    fetch("http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "005272",
      },
      body: JSON.stringify({
        sessionId: "005272",
        location: "auth/proxy.ts:post-authkit",
        message: "authkit completed",
        data: {
          pathname: req.nextUrl.pathname,
          authkitMs: Date.now() - _authStart,
          hasSession: !!session?.user,
          hasAuthUrl: !!authorizationUrl,
        },
        timestamp: Date.now(),
        hypothesisId: "B",
      }),
    }).catch(() => {})
    // #endregion
    const downstream = await handler(req, event)
    // #region agent log
    const _dsStatus =
      downstream instanceof Response ? downstream.status : "unknown"
    const _dsIsRedirect =
      downstream instanceof Response &&
      downstream.status >= 300 &&
      downstream.status < 400
    fetch("http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "005272",
      },
      body: JSON.stringify({
        sessionId: "005272",
        location: "auth/proxy.ts:downstream",
        message: "downstream handler result",
        data: {
          pathname: req.nextUrl.pathname,
          status: _dsStatus,
          isRedirect: _dsIsRedirect,
          isNextResponse: downstream instanceof NextResponse,
          location:
            downstream instanceof Response
              ? downstream.headers.get("location")
              : null,
        },
        timestamp: Date.now(),
        hypothesisId: "C",
      }),
    }).catch(() => {})
    // #endregion
    if (
      downstream instanceof Response &&
      downstream.status >= 300 &&
      downstream.status < 400
    ) {
      return downstream
    }

    const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
      req,
      headers
    )
    const base = NextResponse.next({ request: { headers: requestHeaders } })

    if (downstream instanceof NextResponse) {
      downstream.headers.forEach((value, name) => {
        base.headers.append(name, value)
      })
    }

    return applyResponseHeaders(base, responseHeaders)
  }
}
