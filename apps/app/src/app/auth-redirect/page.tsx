import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * Post-auth routing page. Reached after the WorkOS callback sets the
 * session cookie. Reads the session and routes to the correct destination:
 *
 * - User has active org membership → role-based dashboard
 * - User not in DB or no org yet → onboarding wizard
 */
export default async function AuthRedirectPage() {
  const session = await getSession()

  if (!session) {
    redirect("/onboarding")
  }

  switch (session.productLabel) {
    case "member":
      redirect("/dashboard")
      break
    case "expert":
      redirect("/expert")
      break
    case "clinic_admin":
      redirect("/org")
      break
    case "eleva_operator":
      redirect("/admin")
      break
    default:
      redirect("/onboarding")
  }
}
