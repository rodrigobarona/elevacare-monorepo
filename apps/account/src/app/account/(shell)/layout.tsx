import { getTranslations } from "next-intl/server"
import { guardSession } from "@eleva/auth"
import { getUserOrganizations } from "@eleva/auth/server"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { hasBillableWorkspace } from "./billing/billable"

/**
 * Everything about the person, whatever workspace they use: one place for
 * profile, notifications, security and privacy (ADR-026). Billing shows
 * only for people with a practice or clinic to pay for.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await guardSession()
  const [t, organizations] = await Promise.all([
    getTranslations("nav"),
    getUserOrganizations(),
  ])

  const dashboardConfig = await buildDashboardConfig(
    session,
    [
      {
        label: t("account"),
        items: [
          { title: t("profile"), url: "/account/settings", icon: "UserIcon" },
          {
            title: t("notifications"),
            url: "/account/notifications",
            icon: "BellIcon",
          },
          {
            title: t("security"),
            url: "/account/security",
            icon: "LockSimpleIcon",
          },
          { title: t("privacy"), url: "/account/privacy", icon: "ShieldIcon" },
          {
            title: t("organizations"),
            url: "/account/organizations",
            icon: "BuildingsIcon",
          },
          ...(hasBillableWorkspace(organizations)
            ? [
                {
                  title: t("billing"),
                  url: "/account/billing",
                  icon: "CreditCardIcon" as const,
                },
              ]
            : []),
        ],
      },
    ],
    {
      enableOrgSwitcher: false,
      accountHref: "/account/settings",
    }
  )

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
