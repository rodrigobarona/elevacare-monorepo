import { getLocale, getTranslations } from "next-intl/server"
import { guardSession } from "@eleva/auth"
import { User, CreditCard, Building2, Shield } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import type { DashboardConfig } from "@eleva/dashboard/nav-types"
import { ElevaWidgetsProvider } from "@/components/workos-widgets-provider"

import "@radix-ui/themes/styles.css"
import "@workos-inc/widgets/styles.css"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await guardSession()
  const [locale, t] = await Promise.all([getLocale(), getTranslations("nav")])

  const dashboardConfig: DashboardConfig = {
    homeUrl: "/dashboard",
    navGroups: [
      {
        label: t("account"),
        items: [
          { title: t("profile"), url: "/account/profile", icon: <User /> },
          {
            title: t("billing"),
            url: "/account/billing",
            icon: <CreditCard />,
          },
          {
            title: t("organizations"),
            url: "/account/organizations",
            icon: <Building2 />,
          },
          { title: t("privacy"), url: "/account/privacy", icon: <Shield /> },
        ],
      },
    ],
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
    },
    accountUrl: "/account/profile",
    homepageUrl: "/home",
    logoutUrl: "/logout",
  }

  return (
    <DashboardShell config={dashboardConfig}>
      <ElevaWidgetsProvider locale={locale}>{children}</ElevaWidgetsProvider>
    </DashboardShell>
  )
}
