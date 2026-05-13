import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getSessionForOrg } from "@eleva/auth/server"

const ACCOUNT_SIGNIN_URL =
  process.env.ACCOUNT_URL || "https://account.eleva.care"
const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)

  if (!session) {
    const returnTo = encodeURIComponent(`/${orgSlug}/team`)
    redirect(`${ACCOUNT_SIGNIN_URL}/signin?returnTo=${returnTo}`)
  }

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  if (session.productLabel !== "team_admin") {
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
