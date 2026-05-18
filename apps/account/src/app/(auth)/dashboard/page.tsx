import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { getSession, getSessionForOrg } from "@eleva/auth/server"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LAST_ACTIVE_ORG_COOKIE, RESERVED_SLUGS } from "@eleva/config/routing"

/**
 * Post-auth routing. After WorkOS callback sets the session cookie,
 * this page decides where to send the user:
 *
 * - Has a valid `returnTo` query param -> go there (open-redirect-safe)
 * - Has an active org -> go to eleva.care/[orgSlug]
 * - No org yet -> /onboarding (within account app)
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawReturnTo =
    typeof params.returnTo === "string" ? params.returnTo : undefined
  const returnTo = sanitizeReturnTo(rawReturnTo)

  const jar = await cookies()
  const lastSlug = jar.get(LAST_ACTIVE_ORG_COOKIE)?.value
  const preferredSlug =
    lastSlug && !RESERVED_SLUGS.has(lastSlug) ? lastSlug : undefined

  const session = preferredSlug
    ? await getSessionForOrg(preferredSlug)
    : await getSession()

  if (!session || !session.orgSlug) {
    redirect("/onboarding")
  }

  if (returnTo) {
    redirect(returnTo)
  }

  const h = await headers()
  const appUrl = resolveGatewayUrl(h.get("x-forwarded-host") ?? h.get("host"))

  const slug = session.orgSlug

  if (preferredSlug && preferredSlug !== slug) {
    jar.delete(LAST_ACTIVE_ORG_COOKIE)
  }

  if (RESERVED_SLUGS.has(slug)) {
    jar.delete(LAST_ACTIVE_ORG_COOKIE)
    redirect("/onboarding")
  }

  redirect(`${appUrl}/${slug}`)
}
