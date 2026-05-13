import createMiddleware from "next-intl/middleware"
import type { NextRequest } from "next/server"
import { routing } from "./i18n/routing"
import { APP_ROOT_SEGMENTS, APP_STANDALONE_PATHS } from "@eleva/config/routing"

const intlMiddleware = createMiddleware(routing)

const appPaths = new Set<string>([
  ...APP_ROOT_SEGMENTS,
  ...APP_STANDALONE_PATHS,
])

export default function proxy(request: NextRequest) {
  const firstSegment = request.nextUrl.pathname.split("/")[1] ?? ""

  if (appPaths.has(firstSegment)) {
    return
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
}
