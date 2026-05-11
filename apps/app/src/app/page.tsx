import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * Root of the app zone — reached after the WorkOS callback redirects to "/".
 * Bounces the user to the public gateway (NEXT_PUBLIC_APP_URL) so the
 * browser always lands on the user-facing domain (eleva.care / localhost:3000)
 * rather than the internal app origin (app.eleva.care / localhost:3001).
 */
const gateway =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"

export default async function Page() {
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
      redirect(gateway)
  }
}
