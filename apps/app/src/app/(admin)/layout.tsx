import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/signin")
  }

  if (!session.capabilities.includes("audit:view_all")) {
    redirect(`/${session.orgSlug}`)
  }

  return <>{children}</>
}
