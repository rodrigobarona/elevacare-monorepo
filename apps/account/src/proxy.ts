import { createAuthProxy } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"

export default withHeaders(
  createAuthProxy({
    authFlowPaths: [
      "/login",
      "/signup",
      "/callback",
      "/logout",
      "/verify-email",
      "/reset-password",
      "/two-factor",
    ],
    unauthenticatedPaths: [],
  })
)

export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] }
