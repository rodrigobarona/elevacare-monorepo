import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"
import {
  authkitProxy,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"

/**
 * withAuth proxy wrapper. Composes WorkOS AuthKit's Next.js proxy
 * which handles:
 *   - reading/refreshing the WorkOS session cookie (scope=.eleva.care)
 *   - redirecting unauthenticated users to /signin for protected paths
 *   - exposing the session to Server Components via headers
 *
 * Usage in apps/app/src/proxy.ts:
 *
 *   export default withHeaders(withAuth(intl));
 *
 * The `debug` + `middlewareAuth` config come from env so per-app
 * customisation happens via env rather than code edits.
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

export function withAuth(
  handler: ProxyHandler,
  options: WithAuthOptions = {}
): ProxyHandler {
  const proxy = authkitProxy({
    middlewareAuth: {
      enabled: options.enforce ?? true,
      unauthenticatedPaths:
        options.unauthenticatedPaths ?? DEFAULT_UNAUTH_PATHS,
    },
  })

  return async (req, event) => {
    const authResponse = await proxy(req, event as NextFetchEvent)
    if (
      authResponse &&
      authResponse.status >= 300 &&
      authResponse.status < 400
    ) {
      // AuthKit has already short-circuited with a redirect (e.g. to sign-in).
      return authResponse
    }

    // Otherwise run the downstream handler (next-intl, etc.).
    const downstream = await handler(req, event)
    if (
      downstream instanceof Response &&
      downstream.status >= 300 &&
      downstream.status < 400
    ) {
      return downstream
    }

    if (authResponse) {
      const { responseHeaders } = partitionAuthkitHeaders(
        req,
        authResponse.headers
      )
      const merged =
        downstream instanceof NextResponse
          ? downstream
          : new NextResponse(downstream.body, {
              status: downstream.status,
              headers: downstream.headers,
            })
      return applyResponseHeaders(merged, responseHeaders)
    }
    return downstream
  }
}
