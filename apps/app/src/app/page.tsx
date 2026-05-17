import { redirect } from "next/navigation"
import { guardSession } from "@eleva/auth"

/**
 * App zone root. Not normally reached via the gateway (/ serves marketing).
 * If hit directly on the app origin, redirect to /dashboard which handles
 * role-based routing, or to login if unauthenticated.
 */
export default async function Page() {
  await guardSession()
  redirect("/dashboard")
}
