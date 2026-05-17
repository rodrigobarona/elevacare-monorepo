import { getLocale } from "next-intl/server"
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
  const locale = await getLocale()

  const dashboardConfig: DashboardConfig = {
    navGroups: [
      {
        label: "Account",
        items: [
          { title: "Profile", url: "/account/profile", icon: <User /> },
          { title: "Billing", url: "/account/billing", icon: <CreditCard /> },
          {
            title: "Organizations",
            url: "/account/organizations",
            icon: <Building2 />,
          },
          { title: "Privacy", url: "/account/privacy", icon: <Shield /> },
        ],
      },
    ],
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
    },
    accountUrl: "/account/profile",
    logoutUrl: "/logout",
  }

  return (
    <DashboardShell config={dashboardConfig}>
      <ElevaWidgetsProvider locale={locale}>{children}</ElevaWidgetsProvider>
    </DashboardShell>
  )
}
