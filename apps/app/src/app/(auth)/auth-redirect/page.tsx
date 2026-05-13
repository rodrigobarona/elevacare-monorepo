import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getSession } from "@eleva/auth/server"

const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

/**
 * Post-auth routing page. Reached after the WorkOS callback sets the
 * session cookie. Reads the session and routes to the org home:
 *
 * - User has active org with slug → /[orgSlug] (role-aware home)
 * - User not in DB or no org yet → /onboarding
 *
 * For multi-org users, honours the lastActiveOrgSlug cookie set by
 * the [orgSlug] layout when navigating org-scoped pages.
 */
export default async function AuthRedirectPage() {
  const session = await getSession()

  if (!session || !session.orgSlug) {
    redirect("/onboarding")
  }

  const jar = await cookies()
  const lastSlug = jar.get(LAST_ACTIVE_ORG_COOKIE)?.value

  const slug = lastSlug ?? session.orgSlug
  redirect(`/${slug}`)
}
