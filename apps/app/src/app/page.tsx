import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * App zone root. Not normally reached via the gateway (/ serves marketing).
 * If hit directly on the app origin, redirect to auth-redirect which handles
 * role-based routing, or to signin if unauthenticated.
 */
export default async function Page() {
  const session = await getSession()
  if (!session) redirect("/signin")
  redirect("/auth-redirect")
}
