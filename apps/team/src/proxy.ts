import { NextResponse, type NextRequest } from "next/server"
import {
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"
import { cookieName, isLocale } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { resolveGatewayUrl } from "@eleva/config/env"
import { withHeaders } from "@eleva/observability/proxy"

const SIGNIN_URL = resolveGatewayUrl()

function resolveLocale(req: NextRequest): string {
  const existingCookie = req.cookies.get(cookieName)?.value
  if (existingCookie && isLocale(existingCookie)) {
    return existingCookie
  }

  const acceptLang = req.headers.get("accept-language")
  if (acceptLang) {
    for (const part of acceptLang.split(",")) {
      const lang = part.split(";")[0]!.trim().split("-")[0]!.toLowerCase()
      if (isLocale(lang)) return lang
    }
  }

  return countryToLocale(req.headers.get("x-vercel-ip-country"))
}

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
    const signinUrl = `${SIGNIN_URL}/signin?returnTo=${returnTo}`
    return NextResponse.redirect(signinUrl)
  }

  const locale = resolveLocale(req)
  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
    req,
    headers
  )

  requestHeaders.set("x-eleva-locale", locale)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const existingCookie = req.cookies.get(cookieName)?.value
  if (!existingCookie || existingCookie !== locale) {
    response.cookies.set(cookieName, locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    })
  }

  return applyResponseHeaders(response, responseHeaders)
}

export default withHeaders(handler)

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
