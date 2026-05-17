import { redirect, notFound } from "next/navigation"
import { getSessionForOrg } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
import { resolveGatewayUrl } from "@eleva/config/env"
import { ExpertConnectShell } from "./expert-connect-shell"

export const dynamic = "force-dynamic"

const GATEWAY_URL = resolveGatewayUrl()

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
    redirect(`${GATEWAY_URL}${LOGIN_PATH}?returnTo=${returnTo}`)
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
