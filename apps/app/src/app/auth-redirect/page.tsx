import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * Post-auth routing page. Reached after the WorkOS callback sets the
 * session cookie. Reads the session and routes to the correct destination:
 *
 * - User has active org membership → role-based dashboard
 * - User not in DB or no org yet → onboarding wizard
 */
const gateway =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"

export default async function AuthRedirectPage() {
  const session = await getSession()

  if (!session) {
    redirect(`${gateway}/onboarding`)
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
      redirect(`${gateway}/onboarding`)
  }
}
