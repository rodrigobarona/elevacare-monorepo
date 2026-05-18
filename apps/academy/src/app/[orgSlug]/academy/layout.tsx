import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"
import { UnauthorizedError } from "@eleva/auth"
import { getWidgetTokenFromSession } from "@eleva/auth/server"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LayoutDashboard, BookOpen, BarChart3, Settings } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import type { DashboardConfig } from "@eleva/dashboard/nav-types"

const LAST_ACTIVE_ORG_COOKIE = "eleva-last-org"
const GATEWAY_URL = resolveGatewayUrl()

export default async function AcademyLayout({
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

  const jar = await cookies()
  jar.set(LAST_ACTIVE_ORG_COOKIE, orgSlug, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: true,
  })

  const [widgetTokenResult, t] = await Promise.all([
    getWidgetTokenFromSession().catch((err) => {
      if (!(err instanceof UnauthorizedError)) {
        console.error("Unexpected error generating widget token", err)
        throw err
      }
      return null
    }),
    getTranslations("nav"),
  ])

  const base = `/${orgSlug}/academy`
  const dashboardConfig: DashboardConfig = {
    navGroups: [
      {
        items: [
          { title: t("dashboard"), url: base, icon: <LayoutDashboard /> },
          { title: t("courses"), url: `${base}/courses`, icon: <BookOpen /> },
          {
            title: t("analytics"),
            url: `${base}/analytics`,
            icon: <BarChart3 />,
          },
          {
            title: t("settings"),
            url: `${base}/settings`,
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
    widgetToken: widgetTokenResult,
    accountUrl: `${GATEWAY_URL}/account/profile`,
    homepageUrl: "/home",
    logoutUrl: "/logout",
  }

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
