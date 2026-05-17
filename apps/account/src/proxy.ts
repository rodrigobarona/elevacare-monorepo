import { NextResponse, type NextRequest } from "next/server"
import {
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"
import { withHeaders } from "@eleva/observability/proxy"
import {
  persistLocaleCookie,
  resolveLocaleForRequest,
} from "@eleva/observability/proxy-locale"

/**
 * Routes that drive WorkOS themselves via dedicated route handlers
 * (signin/signup -> getSignInUrl/getSignUpUrl, callback -> handleAuth,
 * logout -> signOut). Short-circuiting here avoids ~50-200ms of cookie
 * decryption + token-refresh round-trip in the WorkOS hosted-UI handoff.
 */
const UNAUTH_PATHS = new Set(["/signin", "/signup", "/callback", "/logout"])

async function handler(req: NextRequest): Promise<NextResponse | Response> {
  const locale = resolveLocaleForRequest(req)

  if (UNAUTH_PATHS.has(req.nextUrl.pathname)) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("x-eleva-locale", locale)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    persistLocaleCookie(req, response, locale)
    return response
  }

  const { session, headers, authorizationUrl } = await authkit(req)

  if (!session.user && authorizationUrl) {
    return handleAuthkitHeaders(req, headers, { redirect: authorizationUrl })
  }

  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
    req,
    headers
  )
  requestHeaders.set("x-eleva-locale", locale)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  persistLocaleCookie(req, response, locale)
  return applyResponseHeaders(response, responseHeaders)
}

export default withHeaders(handler)

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
