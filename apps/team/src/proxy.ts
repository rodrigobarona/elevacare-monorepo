import { createAuthProxy } from "@eleva/auth/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"

/**
 * Team/clinic app: org-scoped team workspace. Unauthenticated users
 * bounce to the gateway's /login with a returnTo pointing back
 * to the current team URL.
 */
export default withHeaders(
  createAuthProxy({
    redirect: { kind: "gateway", baseUrl: resolveGatewayUrl() },
    unauthenticatedPaths: [],
  })
)

// Matcher must be inlined (Next.js static-analyzer requirement).
// Keep in sync with STANDARD_APP_MATCHER in @eleva/observability/proxy.
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] }
