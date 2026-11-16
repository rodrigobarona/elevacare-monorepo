import { getTranslations } from "next-intl/server"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { loadUserWorkspaces } from "@eleva/dashboard/account-menu-server"
import { spacePath } from "@eleva/config/routing"
import { requireMemberSpace } from "@/lib/member-api"

/** The person's own Space at `/space` (ADR-026): one per person, no slug. */
export default async function SpaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireMemberSpace()

  const [t, organizations] = await Promise.all([
    getTranslations("nav"),
    loadUserWorkspaces(session.user.id, session.orgId).catch(() => []),
  ])

  const onlyPersonalSpace =
    organizations.length === 0 ||
    (organizations.length === 1 && organizations[0]?.orgType === "personal")

  const dashboardConfig = await buildDashboardConfig(
    session,
    [
      {
        items: [
          {
            title: t("home"),
            url: spacePath(),
            icon: "SquaresFourIcon",
          },
          {
            title: t("sessions"),
            url: spacePath("sessions"),
            icon: "CalendarDotsIcon",
          },
          {
            title: t("payments"),
            url: spacePath("payments"),
            icon: "CreditCardIcon",
          },
          {
            title: t("reports"),
            url: spacePath("reports"),
            icon: "BookOpenIcon",
          },
          {
            title: t("settings"),
            url: spacePath("settings"),
            icon: "GearIcon",
          },
          {
            title: t("privacy"),
            url: spacePath("privacy"),
            icon: "ShieldIcon",
          },
        ],
      },
    ],
    {
      enableOrgSwitcher: false,
      organizations: onlyPersonalSpace ? [] : organizations,
      inboxUrl: spacePath("notifications"),
    }
  )

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
