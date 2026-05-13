import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getSessionForOrg } from "@eleva/auth/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { ExpertConnectShell } from "./expert-connect-shell"

export const dynamic = "force-dynamic"

const ACCOUNT_SIGNIN_URL =
  process.env.ACCOUNT_URL || "https://account.eleva.care"
const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"

export default async function ExpertLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)

  if (!session) {
    const returnTo = encodeURIComponent(`/${orgSlug}/expert`)
    redirect(`${ACCOUNT_SIGNIN_URL}/signin?returnTo=${returnTo}`)
  }

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  if (
    session.productLabel !== "expert" &&
    session.productLabel !== "team_admin"
  ) {
    notFound()
  }

  const jar = await cookies()
  jar.set(LAST_ACTIVE_ORG_COOKIE, orgSlug, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: true,
  })

  const profile = await getExpertProfileByUserId(session.user.id)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  const stripePublishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

  const showConnect = !!(profile?.stripeAccountId && stripePublishableKey)

  return showConnect ? (
    <ExpertConnectShell
      apiBaseUrl={apiBaseUrl}
      stripePublishableKey={stripePublishableKey}
    >
      {children}
    </ExpertConnectShell>
  ) : (
    <>{children}</>
  )
}
