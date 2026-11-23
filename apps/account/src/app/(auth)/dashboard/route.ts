import { NextResponse, type NextRequest } from "next/server"
import { LOGIN_PATH } from "@eleva/auth"
import { applyExpiredSessionCookies } from "@eleva/auth/proxy"
import {
  getAuthUser,
  getSession,
  getSessionForOrg,
  getSpaceSession,
} from "@eleva/auth/server"
import {
  CONSOLE_RETURN_PARAM,
  consoleReturnPath,
  sanitizeReturnTo,
} from "@eleva/auth/return-to"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  resolveAdminUrl,
  resolveProductHomeUrl,
} from "@eleva/dashboard/resolve-product-home-url"
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

  // Redirects go to the public gateway (dev.eleva.care / eleva.care), not
  // the account app's own host behind the rewrite.
  const gateway = resolveGatewayUrl(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  )

  // The last-org cookie is per browser, not per account: after someone else
  // signs in on the same browser it can name an org they are not in. Fall
  // back to their own session instead of treating them as signed out.
  // `space` means the person's own Space (ADR-026), which has no slug in
  // its address.
  const session =
    (lastSlug === "space"
      ? await getSpaceSession()
      : preferredSlug
        ? await getSessionForOrg(preferredSlug)
        : null) ?? (await getSession())

  if (!session) {
    // Signed in but no Space or membership yet: onboarding sets one up.
    // Only a missing sign-in goes back to the login page.
    if (await getAuthUser()) {
      const response = NextResponse.redirect(new URL("/onboarding", gateway))
      if (lastSlug) response.cookies.delete(LAST_ACTIVE_ORG_COOKIE)
      return response
    }
    const response = NextResponse.redirect(new URL(LOGIN_PATH, gateway))
    applyExpiredSessionCookies(response)
    if (lastSlug) response.cookies.delete(LAST_ACTIVE_ORG_COOKIE)
    return response
  }

  // Someone who signed in from the staff console goes back to the page
  // they were on. Only a path is taken from the link; the console's
  // address is this server's own, and the console checks who they are as
  // it does on every request.
  const consolePath = consoleReturnPath(
    request.nextUrl.searchParams.get(CONSOLE_RETURN_PARAM)
  )
  if (consolePath) {
    return NextResponse.redirect(new URL(consolePath, resolveAdminUrl()))
  }

  if (!session.orgSlug) {
    const response = NextResponse.redirect(new URL("/onboarding", gateway))
    if (lastSlug) response.cookies.delete(LAST_ACTIVE_ORG_COOKIE)
    return response
  }

  const slug = session.orgSlug
  if (RESERVED_SLUGS.has(slug) || !isOrgSlugShape(slug)) {
    const response = NextResponse.redirect(new URL("/onboarding", gateway))
    response.cookies.delete(LAST_ACTIVE_ORG_COOKIE)
    return response
  }

  const home = new URL(resolveProductHomeUrl(session))
  const destination = returnTo
    ? new URL(returnTo, gateway)
    : new URL(`${home.pathname}${home.search}`, gateway)

  const response = NextResponse.redirect(destination)
  const remembered = session.productLabel === "member" ? "space" : slug
  if (lastSlug !== remembered) {
    response.cookies.set(LAST_ACTIVE_ORG_COOKIE, remembered, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
    })
  }

  return response
}
