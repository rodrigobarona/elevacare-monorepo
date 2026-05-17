import { createAuthProxy } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"

/**
 * Account app: gateway-adjacent app that hosts the WorkOS handshake
 * routes. The auth-flow paths short-circuit `authkit()` entirely
 * (saving ~50-200ms of cookie decryption + token refresh on every
 * sign-in click). All other paths require a session and are
 * redirected to the AuthKit authorizationUrl when absent.
 */
export default withHeaders(
  createAuthProxy({
    authFlowPaths: ["/login", "/signup", "/callback", "/logout"],
    unauthenticatedPaths: [],
  })
)

export const config = { matcher: ["/((?!_next|_vercel|.*\\..*).*)"] }
