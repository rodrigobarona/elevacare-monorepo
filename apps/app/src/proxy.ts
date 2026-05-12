import { NextResponse, type NextRequest } from "next/server"
import { cookieName, isLocale } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { APP_STANDALONE_PATHS } from "@eleva/config/routing"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"

const AUTH_FLOW_PATHS = APP_STANDALONE_PATHS.map((p) => `/${p}`)

/**
 * Resolve locale from the request and set it as a request header so
 * next-intl's getRequestConfig can pick it up without URL-based routing.
 *
 * Resolution order: ELEVA_LOCALE cookie > Accept-Language > Vercel geo > en
 */
function resolveAndSetLocale(req: NextRequest): NextResponse {
  const existingCookie = req.cookies.get(cookieName)?.value
  let locale: string | undefined

  if (existingCookie && isLocale(existingCookie)) {
    locale = existingCookie
  }

  if (!locale) {
    const acceptLang = req.headers.get("accept-language")
    if (acceptLang) {
      for (const part of acceptLang.split(",")) {
        const lang = part.split(";")[0]!.trim().split("-")[0]!.toLowerCase()
        if (isLocale(lang)) {
          locale = lang
          break
        }
      }
    }
  }

  if (!locale) {
    locale = countryToLocale(req.headers.get("x-vercel-ip-country"))
  }

  const response = NextResponse.next({
    request: {
      headers: new Headers(req.headers),
    },
  })

  // Pass resolved locale via header for getRequestConfig
  response.headers.set("x-eleva-locale", locale)

  // Set/refresh the ELEVA_LOCALE cookie if not already present
  if (!existingCookie || existingCookie !== locale) {
    response.cookies.set(cookieName, locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    })
  }

  return response
}

const handler = (req: NextRequest) => {
  return resolveAndSetLocale(req)
}

export default withHeaders(
  withAuth(handler, {
    unauthenticatedPaths: [
      "/",
      "/home",
      "/about",
      "/legal/:path*",
      ...AUTH_FLOW_PATHS,
    ],
  })
)

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
