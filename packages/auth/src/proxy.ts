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

    const downstream = await handler(req, event)
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
