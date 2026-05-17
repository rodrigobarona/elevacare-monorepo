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
import { isUnauthenticatedPath, trackLastActiveOrg } from "./lib/proxy-routing"

async function handler(req: NextRequest): Promise<NextResponse | Response> {
  const { session, headers, authorizationUrl } = await authkit(req)

  if (
    !session.user &&
    authorizationUrl &&
    !isUnauthenticatedPath(req.nextUrl.pathname)
  ) {
    return handleAuthkitHeaders(req, headers, { redirect: authorizationUrl })
  }

  const locale = resolveLocaleForRequest(req)
  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
    req,
    headers
  )
  requestHeaders.set("x-eleva-locale", locale)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  persistLocaleCookie(req, response, locale)
  if (session.user) trackLastActiveOrg(req, response)
  return applyResponseHeaders(response, responseHeaders)
}

export default withHeaders(handler)

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
