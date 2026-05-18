import "@radix-ui/themes/styles.css"

import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSessionForOrg } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LayoutDashboard, Users, Settings } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"

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

  const t = await getTranslations("nav")

  const base = `/${orgSlug}/team`
  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [
        { title: t("dashboard"), url: base, icon: <LayoutDashboard /> },
        { title: t("members"), url: `${base}/members`, icon: <Users /> },
        { title: t("settings"), url: `${base}/settings`, icon: <Settings /> },
      ],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
