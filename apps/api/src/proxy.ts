import { NextResponse, type NextRequest } from "next/server"
import { createPassthroughProxy } from "@eleva/observability/proxy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { isOrgSlugShape, WORKSPACE_NAMESPACES } from "@eleva/config/routing"

const passthrough = createPassthroughProxy()

/**
 * Better Auth magic-link verify and OAuth callbacks live on this origin.
 * A relative `callbackURL` then 404s here (`/space/...`, `/join/...`).
 * Bounce those document GETs to the gateway.
 *
 * `/expert/*` is not bounced: the API serves its own `/expert/...`
 * routes, so expert pages must always pass an absolute `callbackURL`.
 */
const GATEWAY_ONLY_NAMESPACES: ReadonlySet<string> = new Set(
  WORKSPACE_NAMESPACES.filter((ns) => ns !== "expert")
)

function isMisroutedProductPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (
    first === "join" ||
    first === "dashboard" ||
    first === "login" ||
    first === "callback" ||
    (typeof first === "string" && GATEWAY_ONLY_NAMESPACES.has(first))
  ) {
    return true
  }
  const second = segments[1]
  return (
    segments.length >= 2 &&
    typeof first === "string" &&
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
