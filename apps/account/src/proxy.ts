import { NextResponse, type NextRequest } from "next/server"
import {
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"
import { cookieName, isLocale } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { withHeaders } from "@eleva/observability/proxy"

const UNAUTH_PATHS = ["/signin", "/signup", "/callback", "/logout"]

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
 * Account app proxy: AuthKit auth + locale resolution.
 *
 * Auth routes (/signin, /signup, /callback, /logout) are allowed
 * without a session. All other routes require authentication --
 * unauthenticated users are redirected to /signin.
 */
async function handler(req: NextRequest): Promise<NextResponse | Response> {
  const { session, headers, authorizationUrl } = await authkit(req)
  const pathname = req.nextUrl.pathname

  const isUnauthPath = UNAUTH_PATHS.some((p) => pathname === p)

  if (!session.user && authorizationUrl && !isUnauthPath) {
    return handleAuthkitHeaders(req, headers, {
      redirect: authorizationUrl,
    })
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
