import { NextResponse, type NextRequest } from "next/server"
import {
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs"
import { cookieName, isLocale } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { APP_STANDALONE_PATHS } from "@eleva/config/routing"
import { withHeaders } from "@eleva/observability/proxy"

const AUTH_FLOW_PATHS = APP_STANDALONE_PATHS.map((p) => `/${p}`)

const UNAUTH_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  ...AUTH_FLOW_PATHS,
]

function isUnauthenticatedPath(pathname: string, paths: string[]): boolean {
  for (const pattern of paths) {
    if (pattern.endsWith("/:path*")) {
      const prefix = pattern.slice(0, -"/:path*".length)
      if (pathname === prefix || pathname.startsWith(prefix + "/")) return true
    } else if (pathname === pattern) {
      return true
    }
  }
  return false
}

/**
 * Resolve locale from the request.
 * Resolution order: ELEVA_LOCALE cookie > Accept-Language > Vercel geo > en
 */
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
 * Unified proxy handler: AuthKit auth + locale resolution.
 *
 * Uses AuthKit's composable API directly so we can inject
 * `x-eleva-locale` into the *request* headers that Server Components
 * read via `headers()` in getRequestConfig.
 */
async function handler(req: NextRequest): Promise<NextResponse | Response> {
  const { session, headers, authorizationUrl } = await authkit(req)

  if (!session.user && authorizationUrl) {
    if (!isUnauthenticatedPath(req.nextUrl.pathname, UNAUTH_PATHS)) {
      return handleAuthkitHeaders(req, headers, {
        redirect: authorizationUrl,
      })
    }
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
