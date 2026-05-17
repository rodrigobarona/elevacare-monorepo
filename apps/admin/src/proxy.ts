import { createAuthProxy } from "@eleva/auth/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"

/**
 * Admin app: protected back-office. Unauthenticated users bounce to
 * the gateway's /login so the WorkOS handshake happens at eleva.care.
 */
export default withHeaders(
  createAuthProxy({
    redirect: { kind: "gateway", baseUrl: resolveGatewayUrl() },
    unauthenticatedPaths: [],
  })
)

export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] }
