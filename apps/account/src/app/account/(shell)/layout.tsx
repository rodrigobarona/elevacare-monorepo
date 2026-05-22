import { getTranslations } from "next-intl/server"
import { guardSession } from "@eleva/auth"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import "@radix-ui/themes/styles.css"
import "@workos-inc/widgets/styles.css"
import "@eleva/dashboard/workos-widgets-overrides.css"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await guardSession()
  const t = await getTranslations("nav")

  const dashboardConfig = await buildDashboardConfig(
    session,
    [
      {
        label: t("account"),
        items: [
          { title: t("settings"), url: "/account/settings", icon: "UserIcon" },
          {
            title: t("billing"),
            url: "/account/billing",
            icon: "CreditCardIcon",
          },
          {
            title: t("organizations"),
            url: "/account/organizations",
            icon: "BuildingsIcon",
          },
          { title: t("privacy"), url: "/account/privacy", icon: "ShieldIcon" },
        ],
      },
    ],
    {
      enableOrgSwitcher: false,
      accountUrl: "/account/settings",
    }
  )

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
