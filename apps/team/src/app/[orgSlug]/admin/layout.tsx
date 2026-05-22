import "@radix-ui/themes/styles.css"

import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSessionForOrg } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { resolveTeamAdminBase } from "@eleva/auth/org-routing"
import { resolveGatewayUrl } from "@eleva/config/env"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"

const GATEWAY_URL = resolveGatewayUrl()

export default async function TeamAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)

  const base = resolveTeamAdminBase(orgSlug)

  if (!session) {
    redirect(`${GATEWAY_URL}${LOGIN_PATH}?returnTo=${encodeURIComponent(base)}`)
  }

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  if (session.productLabel !== "team_admin") {
    notFound()
  }

  const t = await getTranslations("nav")

  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [
        { title: t("dashboard"), url: base, icon: "SquaresFourIcon" },
        { title: t("members"), url: `${base}/members`, icon: "UsersIcon" },
        { title: t("settings"), url: `${base}/settings`, icon: "GearIcon" },
      ],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
