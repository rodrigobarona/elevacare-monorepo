import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getSession } from "@eleva/auth/server"

const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eleva.care"

/**
 * Post-auth routing. After WorkOS callback sets the session cookie,
 * this page decides where to send the user:
 *
 * - Has a `returnTo` query param -> go there (cross-app redirect)
 * - Has an active org -> go to eleva.care/[orgSlug]
 * - No org yet -> /onboarding (within account app)
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const returnTo =
    typeof params.returnTo === "string" ? params.returnTo : undefined

  const session = await getSession()

  if (!session || !session.orgSlug) {
    redirect("/onboarding")
  }

  if (returnTo) {
    try {
      const url = new URL(decodeURIComponent(returnTo))
      if (url.hostname.endsWith("eleva.care")) {
        redirect(url.toString())
      }
    } catch {
      // invalid returnTo, fall through
    }
  }

  const jar = await cookies()
  const lastSlug = jar.get(LAST_ACTIVE_ORG_COOKIE)?.value
  const slug = lastSlug ?? session.orgSlug

  redirect(`${APP_URL}/${slug}`)
}
