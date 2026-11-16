import { createAuthProxy } from "@eleva/auth/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"
import { MEMBER_APP_UNAUTHENTICATED_PATHS } from "./lib/proxy-routing"

/**
 * Member app: the person's own Space at /space plus guest /join links. The
 * shared auth proxy remembers /space as the last active workspace (used by
 * /dashboard to bring the person back).
 */
export default withHeaders(
  createAuthProxy({
    redirect: { kind: "gateway", baseUrl: resolveGatewayUrl() },
    unauthenticatedPaths: MEMBER_APP_UNAUTHENTICATED_PATHS,
  }),
  { noindex: true }
)

export const config = { matcher: ["/((?!_next|_vercel|.*\\..*).*)"] }
