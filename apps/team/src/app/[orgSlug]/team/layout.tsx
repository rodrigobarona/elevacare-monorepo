import "@radix-ui/themes/styles.css"

import { redirect, notFound } from "next/navigation"
import { getSessionForOrg, getWidgetTokenFromSession } from "@eleva/auth/server"
import { LOGIN_PATH, UnauthorizedError } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LayoutDashboard, Users, Settings } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import type { DashboardConfig } from "@eleva/dashboard/nav-types"

const GATEWAY_URL = resolveGatewayUrl()

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
    redirect(`${GATEWAY_URL}${LOGIN_PATH}?returnTo=${returnTo}`)
  }

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  if (session.productLabel !== "team_admin") {
    notFound()
  }

  let widgetToken: string | null = null
  try {
    widgetToken = await getWidgetTokenFromSession()
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) {
      console.error("Unexpected error generating widget token", err)
      throw err
    }
  }

  const base = `/${orgSlug}/team`
  const dashboardConfig: DashboardConfig = {
    navGroups: [
      {
        items: [
          { title: "Dashboard", url: base, icon: <LayoutDashboard /> },
          { title: "Members", url: `${base}/members`, icon: <Users /> },
          { title: "Settings", url: `${base}/settings`, icon: <Settings /> },
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

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
