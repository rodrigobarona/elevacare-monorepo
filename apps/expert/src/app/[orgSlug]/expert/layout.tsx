import "@radix-ui/themes/styles.css"

import { redirect, notFound } from "next/navigation"
import { getSessionForOrg, getWidgetTokenFromSession } from "@eleva/auth/server"
import { LOGIN_PATH, UnauthorizedError } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Clock,
  Plug,
  Wallet,
} from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import type { DashboardConfig } from "@eleva/dashboard/nav-types"
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

  let widgetToken: string | null = null
  try {
    widgetToken = await getWidgetTokenFromSession()
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) {
      console.error("Unexpected error generating widget token", err)
      throw err
    }
  }

  const base = `/${orgSlug}/expert`
  const dashboardConfig: DashboardConfig = {
    navGroups: [
      {
        items: [
          { title: "Dashboard", url: base, icon: <LayoutDashboard /> },
          {
            title: "Event Types",
            url: `${base}/event-types`,
            icon: <CalendarDays />,
            needs: "events:manage",
          },
          {
            title: "Schedule",
            url: `${base}/schedule`,
            icon: <Clock />,
            needs: "schedule:manage",
          },
          {
            title: "Calendars",
            url: `${base}/calendars`,
            icon: <Calendar />,
            needs: "events:manage",
          },
          {
            title: "Integrations",
            url: `${base}/integrations`,
            icon: <Plug />,
            needs: "events:manage",
          },
          {
            title: "Finance",
            url: `${base}/finance`,
            icon: <Wallet />,
            needs: "payouts:view_own",
          },
        ],
      },
    ],
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
    },
    orgSlug,
    capabilities: session.capabilities,
    widgetToken,
    accountUrl: "/account/profile",
    logoutUrl: "/logout",
  }

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
