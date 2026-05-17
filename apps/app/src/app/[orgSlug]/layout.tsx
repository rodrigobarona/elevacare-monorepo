import "@radix-ui/themes/styles.css"

import { notFound } from "next/navigation"
import { guardSessionForOrg, UnauthorizedError } from "@eleva/auth"
import { getWidgetTokenFromSession } from "@eleva/auth/server"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LayoutDashboard, Settings } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import type { DashboardConfig } from "@eleva/dashboard/nav-types"

const GATEWAY_URL = resolveGatewayUrl()

export default async function OrgSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSessionForOrg(orgSlug)

  if (session.orgSlug !== orgSlug) {
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

  const dashboardConfig: DashboardConfig = {
    navGroups: [
      {
        items: [
          {
            title: "Dashboard",
            url: `/${orgSlug}`,
            icon: <LayoutDashboard />,
            needs: "appointments:view_own",
          },
          {
            title: "Settings",
            url: `${GATEWAY_URL}/account/profile`,
            icon: <Settings />,
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
    accountUrl: `${GATEWAY_URL}/account/profile`,
    logoutUrl: "/logout",
  }

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
