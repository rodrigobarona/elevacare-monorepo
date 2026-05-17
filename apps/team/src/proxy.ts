import { NextResponse, type NextRequest } from "next/server"
import {
  authkit,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"
import {
  persistLocaleCookie,
  resolveLocaleForRequest,
} from "@eleva/observability/proxy-locale"

const SIGNIN_URL = resolveGatewayUrl()

/**
 * Team/clinic app proxy: AuthKit + locale resolution.
 *
 * Unauthenticated users are redirected to eleva.care/signin
 * with a returnTo pointing back to the current team URL.
 */
async function handler(req: NextRequest): Promise<NextResponse | Response> {
  const { session, headers, authorizationUrl } = await authkit(req)

  if (!session.user && authorizationUrl) {
    const returnTo = encodeURIComponent(req.nextUrl.toString())
    return NextResponse.redirect(`${SIGNIN_URL}/signin?returnTo=${returnTo}`)
  }

  const locale = resolveLocaleForRequest(req)
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
