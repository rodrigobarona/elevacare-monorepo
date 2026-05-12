import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

/**
 * App zone root. Not normally reached via the gateway (/ serves marketing).
 * If hit directly on the app origin, redirect to auth-redirect which handles
 * role-based routing, or to signin if unauthenticated.
 */
const gateway =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"

export default async function Page() {
  const session = await getSession()
  if (!session) redirect(`${gateway}/signin`)
  redirect(`${gateway}/auth-redirect`)
}
