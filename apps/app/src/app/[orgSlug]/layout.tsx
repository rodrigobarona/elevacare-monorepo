import "@radix-ui/themes/styles.css"

import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"

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
    redirect(resolveProductHomeUrl(session))
  }

  const t = await getTranslations("nav")

  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [
        {
          title: t("dashboard"),
          url: `/${orgSlug}`,
          icon: "SquaresFourIcon",
          needs: "appointments:view_own",
        },
        {
          title: t("settings"),
          url: `/${orgSlug}/settings`,
          icon: "GearIcon",
        },
      ],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
