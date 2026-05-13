import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { ExpertConnectShell } from "./expert-connect-shell"

export const dynamic = "force-dynamic"

export default async function ExpertLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/signin")

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
