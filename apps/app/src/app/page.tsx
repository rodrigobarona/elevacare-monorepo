import { redirect } from "next/navigation"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getSession } from "@eleva/auth/server"
import { provisionNewUser } from "@/lib/provision-user"

/**
 * Root of the app zone — reached after the WorkOS callback redirects to "/".
 * Bounces the user to the public gateway (NEXT_PUBLIC_APP_URL) so the
 * browser always lands on the user-facing domain (eleva.care / localhost:3000)
 * rather than the internal app origin (app.eleva.care / localhost:3001).
 *
 * On first sign-in the Eleva DB has no records yet (user/org/membership).
 * We detect this case (getSession returns null while a valid WorkOS cookie
 * exists) and provision the personal org before redirecting.
 */
const gateway =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"

export default async function Page() {
  let session = await getSession()

  if (!session) {
    const workosSession = await withAuth()
    if (!workosSession.user) redirect(`${gateway}/signin`)

    session = await provisionNewUser(
      workosSession.user,
      workosSession.organizationId
    )

    if (!session) redirect(`${gateway}/signin`)
  }

  switch (session.productLabel) {
    case "patient":
      redirect(`${gateway}/patient`)
      break
    case "expert":
      redirect(`${gateway}/expert`)
      break
    case "clinic_admin":
      redirect(`${gateway}/org`)
      break
    case "eleva_operator":
      redirect(`${gateway}/admin`)
      break
    default:
      redirect(`${gateway}/signin`)
  }
}
