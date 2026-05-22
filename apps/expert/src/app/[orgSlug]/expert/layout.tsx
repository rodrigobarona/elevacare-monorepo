import "@radix-ui/themes/styles.css"

import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSessionForOrg } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
import { resolveGatewayUrl } from "@eleva/config/env"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
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

  const t = await getTranslations("nav")

  const base = `/${orgSlug}/expert`
  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [
        { title: t("dashboard"), url: base, icon: "SquaresFourIcon" },
        {
          title: t("eventTypes"),
          url: `${base}/event-types`,
          icon: "CalendarDotsIcon",
          needs: "events:manage",
        },
        {
          title: t("schedule"),
          url: `${base}/schedule`,
          icon: "ClockIcon",
          needs: "schedule:manage",
        },
        {
          title: t("calendars"),
          url: `${base}/calendars`,
          icon: "CalendarIcon",
          needs: "events:manage",
        },
        {
          title: t("integrations"),
          url: `${base}/integrations`,
          icon: "PlugIcon",
          needs: "events:manage",
        },
        {
          title: t("finance"),
          url: `${base}/finance`,
          icon: "WalletIcon",
          needs: "payouts:view_own",
        },
      ],
    },
  ])

  const content = (
    <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
  )

  return showConnect ? (
    <ExpertConnectShell
      apiBaseUrl={apiBaseUrl}
      stripePublishableKey={stripePublishableKey}
    >
      {content}
    </ExpertConnectShell>
  ) : (
    content
  )
}
