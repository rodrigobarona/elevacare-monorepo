import { createAuthProxy } from "@eleva/auth/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"

/**
 * Academy app: org-scoped learning portal. Unauthenticated users
 * bounce to the gateway's /login with a returnTo pointing back
 * to the current academy URL.
 */
export default withHeaders(
  createAuthProxy({
    redirect: { kind: "gateway", baseUrl: resolveGatewayUrl() },
    unauthenticatedPaths: [],
  })
)

export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] }
