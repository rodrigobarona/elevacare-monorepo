import { createAuthProxy } from "@eleva/auth/proxy"
import { consoleReturnTo } from "@eleva/auth/return-to"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"

/**
 * Admin app: protected back-office. Unauthenticated users bounce to
 * the gateway's /login so the Better Auth handshake happens at eleva.care,
 * and come back to the console page they asked for: named by its path,
 * because the console's own address is not one sign-in returns to.
 */
export default withHeaders(
  createAuthProxy({
    redirect: {
      kind: "gateway",
      baseUrl: resolveGatewayUrl(),
      returnTo: (req) =>
        consoleReturnTo(`${req.nextUrl.pathname}${req.nextUrl.search}`),
    },
    unauthenticatedPaths: [],
  }),
  { noindex: true }
)

// Matcher must be inlined (Next.js static-analyzer requirement).
// Keep in sync with STANDARD_APP_MATCHER in @eleva/observability/proxy.
export const config = { matcher: ["/((?!api/|_next|_vercel|.*\\..*).*)"] }
