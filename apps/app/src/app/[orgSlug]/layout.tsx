import { redirect, notFound } from "next/navigation"
import { getSessionForOrg } from "@eleva/auth/server"

export default async function OrgSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)

  if (!session) {
    redirect("/signin")
  }

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  return <>{children}</>
}
