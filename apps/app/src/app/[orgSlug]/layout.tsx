import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getSessionForOrg } from "@eleva/auth/server"

const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

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

  const jar = await cookies()
  jar.set(LAST_ACTIVE_ORG_COOKIE, orgSlug, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: true,
  })

  return <>{children}</>
}
