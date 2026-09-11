import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"
import { listUserOrganizations } from "@eleva/auth/organizations"
import { guardSessionForOrg } from "@eleva/auth"

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

  const [t, organizations] = await Promise.all([
    getTranslations("nav"),
    listUserOrganizations({
      userId: session.user.id,
      currentOrgId: session.orgId,
    }).catch(() => []),
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
            url: `/${orgSlug}`,
            icon: "SquaresFourIcon",
          },
          {
            title: t("sessions"),
            url: `/${orgSlug}/sessions`,
            icon: "CalendarDotsIcon",
          },
          {
            title: t("payments"),
            url: `/${orgSlug}/payments`,
            icon: "CreditCardIcon",
          },
          {
            title: t("settings"),
            url: `/${orgSlug}/settings`,
            icon: "GearIcon",
          },
          {
            title: t("privacy"),
            url: `/${orgSlug}/privacy`,
            icon: "ShieldIcon",
          },
        ],
      },
    ],
    {
      enableOrgSwitcher: false,
      organizations: onlyPersonalSpace ? [] : organizations,
    }
  )

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
