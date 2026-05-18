import "@eleva/ui/globals.css"
import { redirect } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LayoutDashboard, UserCheck } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import type { DashboardConfig } from "@eleva/dashboard/nav-types"

const GATEWAY_URL = resolveGatewayUrl()
const APP_URL = GATEWAY_URL

export const metadata = {
  title: "Eleva.care — Admin",
  description: "Platform operator console for Eleva.care",
}

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect(`${GATEWAY_URL}${LOGIN_PATH}`)
  }

  if (!session.capabilities.includes("audit:view_all")) {
    redirect(`${APP_URL}/${session.orgSlug}`)
  }

  const [locale, messages, t] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("nav"),
  ])

  const dashboardConfig: DashboardConfig = {
    navGroups: [
      {
        items: [
          { title: t("overview"), url: "/", icon: <LayoutDashboard /> },
          {
            title: t("partnerApplications"),
            url: "/become-partner",
            icon: <UserCheck />,
          },
        ],
      },
    ],
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
    },
    accountUrl: `${GATEWAY_URL}/account/profile`,
    homepageUrl: "/home",
    logoutUrl: "/logout",
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
