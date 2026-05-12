import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * Post-auth landing page. Reached after the WorkOS callback provisions the
 * user and redirects here. Reads the session (which now has DB records) and
 * bounces to the role-appropriate dashboard on the gateway.
 */
const gateway =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"

export default async function AuthRedirectPage() {
  const session = await getSession()
  if (!session) redirect(`${gateway}/signin`)

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
