import { NextResponse, type NextRequest } from "next/server"
import { createPassthroughProxy } from "@eleva/observability/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { isOrgSlugShape } from "@eleva/config/routing"

const passthrough = createPassthroughProxy()

/**
 * Better Auth magic-link verify lives on this origin. A relative
 * `callbackURL` then 404s here (`/rbarona/team/...`, `/join/...`).
 * Bounce those document GETs to the gateway.
 */
function isMisroutedProductPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (
    first === "join" ||
    first === "dashboard" ||
    first === "login" ||
    first === "callback"
  ) {
    return true
  }
  const second = segments[1]
  return (
    segments.length >= 2 &&
    Boolean(first) &&
    isOrgSlugShape(first) &&
    second === "team"
  )
}

export default function proxy(req: NextRequest) {
  if (req.method === "GET" && isMisroutedProductPath(req.nextUrl.pathname)) {
    const gateway = resolveGatewayUrl().replace(/\/$/, "")
    return NextResponse.redirect(
      `${gateway}${req.nextUrl.pathname}${req.nextUrl.search}`
    )
  }
  return passthrough(req)
}

export const config = { matcher: ["/:path*"] }
