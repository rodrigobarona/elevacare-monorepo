import { NextResponse, type NextRequest } from "next/server"
import { getSession, getSessionForOrg } from "@eleva/auth/server"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  LAST_ACTIVE_ORG_COOKIE,
  RESERVED_SLUGS,
  isOrgSlugShape,
} from "@eleva/config/routing"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

/**
 * Post-auth routing. This must be a Route Handler, not a Server
 * Component, because it repairs the last-active-org cookie before
 * redirecting.
 */
export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  )
  const lastSlug = request.cookies.get(LAST_ACTIVE_ORG_COOKIE)?.value
  const preferredSlug =
    lastSlug && !RESERVED_SLUGS.has(lastSlug) && isOrgSlugShape(lastSlug)
      ? lastSlug
      : undefined

  const session = preferredSlug
    ? await getSessionForOrg(preferredSlug)
    : await getSession()

  if (!session || !session.orgSlug) {
    const response = NextResponse.redirect(new URL("/onboarding", request.url))
    if (lastSlug) response.cookies.delete(LAST_ACTIVE_ORG_COOKIE)
    return response
  }

  const slug = session.orgSlug
  if (RESERVED_SLUGS.has(slug) || !isOrgSlugShape(slug)) {
    const response = NextResponse.redirect(new URL("/onboarding", request.url))
    response.cookies.delete(LAST_ACTIVE_ORG_COOKIE)
    return response
  }

  const destination = returnTo
    ? new URL(returnTo, request.url)
    : new URL(
        `/${slug}`,
        resolveGatewayUrl(
          request.headers.get("x-forwarded-host") ?? request.headers.get("host")
        )
      )

  const response = NextResponse.redirect(destination)
  if (lastSlug !== slug) {
    response.cookies.set(LAST_ACTIVE_ORG_COOKIE, slug, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
    })
  }

  return response
}
