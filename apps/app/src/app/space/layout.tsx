import { getTranslations } from "next-intl/server"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { resolveGatewayUrl } from "@eleva/config/env"
import { spacePath } from "@eleva/config/routing"
import { requireMemberSpace } from "@/lib/member-api"

/**
 * The person's own Space at `/space` (ADR-026): one per person, no slug.
 * The sidebar always shows the workspace switcher, even when the Space is
 * the only workspace, so "Create workspace" is one tap away. Settings and
 * Privacy belong to the person, not the Space, so they open `/account`.
 */
export default async function SpaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireMemberSpace()
  const t = await getTranslations("nav")
  const gateway = resolveGatewayUrl()

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
        ],
      },
      {
        label: t("account"),
        items: [
          {
            title: t("settings"),
            url: `${gateway}/account/settings`,
            icon: "GearIcon",
          },
          {
            title: t("privacy"),
            url: `${gateway}/account/privacy`,
            icon: "ShieldIcon",
          },
        ],
      },
    ],
    { inboxUrl: spacePath("notifications") }
  )

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
