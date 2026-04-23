import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * Root of the app zone. Authenticated -> redirect to role home.
 * Unauthenticated -> redirect to /signin.
 *
 * The gateway normally routes `eleva.care/` through the marketing app
 * first and only rewrites role paths to us, so this page only fires
 * when a user hits the app-zone's internal URL directly (previews).
 */
export default async function Page() {
  const session = await getSession()
  if (!session) redirect("/signin")
  switch (session.productLabel) {
    case "patient":
      redirect("/patient")
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
  }
}
