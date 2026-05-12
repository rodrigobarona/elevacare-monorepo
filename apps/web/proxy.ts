import { NextResponse, type NextRequest } from "next/server"
import createIntl from "next-intl/middleware"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"
import { cookieName } from "@eleva/config/i18n"
import { countryToLocale } from "@eleva/config/country-to-locale"
import { APP_REWRITE_PATHS } from "@eleva/config/routing"
import { routing } from "./i18n/routing"

const APP_BYPASS = new Set(APP_REWRITE_PATHS.map((p) => `/${p}`))

function shouldBypass(pathname: string): boolean {
  if (APP_BYPASS.has(pathname)) return true
  for (const prefix of APP_BYPASS) {
    if (pathname.startsWith(prefix + "/")) return true
  }
  return false
}

const intl = createIntl(routing)

const handler = (req: NextRequest) => {
  // #region agent log
  const isRSC =
    req.headers.has("rsc") ||
    req.headers.has("next-router-state-tree") ||
    req.nextUrl.searchParams.has("_rsc")
  fetch("http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "005272",
    },
    body: JSON.stringify({
      sessionId: "005272",
      location: "proxy.ts:handler-entry",
      message: "Middleware handler called",
      data: {
        pathname: req.nextUrl.pathname,
        isRSC,
        method: req.method,
        hasCookie: req.cookies.has(cookieName),
        rscHeader: req.headers.get("rsc"),
        nextRouterState: !!req.headers.get("next-router-state-tree"),
      },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {})
  // #endregion

  if (shouldBypass(req.nextUrl.pathname)) {
    // #region agent log
    fetch("http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "005272",
      },
      body: JSON.stringify({
        sessionId: "005272",
        location: "proxy.ts:bypass",
        message: "Bypassing middleware",
        data: { pathname: req.nextUrl.pathname },
        timestamp: Date.now(),
        hypothesisId: "A",
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.next()
  }

  // On first visit (no locale cookie), seed the cookie from geo so
  // next-intl's detection chain (URL > cookie > Accept-Language >
  // defaultLocale) picks it up before falling back to "en".
  if (!req.cookies.has(cookieName)) {
    const geoLocale = countryToLocale(req.headers.get("x-vercel-ip-country"))
    if (geoLocale !== routing.defaultLocale) {
      req.cookies.set(cookieName, geoLocale)
    }
  }

  const intlRes = intl(req)
  // #region agent log
  Promise.resolve(intlRes)
    .then((r) => {
      const isRedirect = r.status >= 300 && r.status < 400
      fetch(
        "http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "005272",
          },
          body: JSON.stringify({
            sessionId: "005272",
            location: "proxy.ts:intl-result",
            message: "intl middleware result",
            data: {
              pathname: req.nextUrl.pathname,
              isRSC,
              status: r.status,
              isRedirect,
              location: r.headers.get("location"),
              setCookie: r.headers.get("set-cookie")?.substring(0, 100),
            },
            timestamp: Date.now(),
            hypothesisId: "A",
          }),
        }
      ).catch(() => {})
    })
    .catch(() => {})
  // #endregion
  return intlRes
}

export default withHeaders(withAuth(handler, { enforce: false }))

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
