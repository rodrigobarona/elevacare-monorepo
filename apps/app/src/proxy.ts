import { createAuthProxy } from "@eleva/auth/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"
import {
  MEMBER_APP_UNAUTHENTICATED_PATHS,
  trackLastActiveOrg,
} from "./lib/proxy-routing"

/**
 * Member app: protected app that ALSO serves marketing-shaped public
 * routes (/, /home, /about, /legal/...). Authenticated visits to any
 * first-level segment that isn't a fixed app segment are tracked as
 * the user's last active org (used by /dashboard to bounce them back).
 */
export default withHeaders(
  createAuthProxy({
    redirect: { kind: "gateway", baseUrl: resolveGatewayUrl() },
    unauthenticatedPaths: MEMBER_APP_UNAUTHENTICATED_PATHS,
    onAuthenticated: trackLastActiveOrg,
  })
)

export const config = { matcher: ["/((?!_next|_vercel|.*\\..*).*)"] }
