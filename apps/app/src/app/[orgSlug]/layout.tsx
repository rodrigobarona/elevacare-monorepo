import "@radix-ui/themes/styles.css"

import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"
import { LayoutDashboard, Settings } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"

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

  const t = await getTranslations("nav")

  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [
        {
          title: t("dashboard"),
          url: `/${orgSlug}`,
          icon: <LayoutDashboard />,
          needs: "appointments:view_own",
        },
        {
          title: t("settings"),
          url: `/${orgSlug}/settings`,
          icon: <Settings />,
        },
      ],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
