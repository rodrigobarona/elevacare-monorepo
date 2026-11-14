import { NextResponse, type NextRequest } from "next/server"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  LAST_ACTIVE_ORG_COOKIE,
  RESERVED_SLUGS,
  isOrgSlugShape,
} from "@eleva/config/routing"

export const dynamic = "force-dynamic"

/**
 * Onboarding found a membership the person already has (an invitation, an
 * earlier Space): remember that org, then let `/dashboard` route them. A
 * Route Handler, because only a handler or an action may set cookies.
 *
 * The slug is only a preference. `/dashboard` checks it against the
 * person's own memberships and falls back to their session, so an
 * arbitrary value here cannot grant access to anything.
 */
export function GET(request: NextRequest) {
  const gateway = resolveGatewayUrl(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  )
  const response = NextResponse.redirect(new URL("/dashboard", gateway))
  const slug = request.nextUrl.searchParams.get("org")
  if (slug && isOrgSlugShape(slug) && !RESERVED_SLUGS.has(slug)) {
    response.cookies.set(LAST_ACTIVE_ORG_COOKIE, slug, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
    })
  }
  return response
}
