import "./styles.css"
import { redirect } from "next/navigation"
import { fontClassName } from "@eleva/ui/fonts"
import { cn } from "@eleva/ui/lib/utils"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LayoutDashboard } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { DashboardProviders } from "@eleva/dashboard/dashboard-providers"
import {
  getServerAppearance,
  getServerThemePreference,
} from "@eleva/dashboard/server-theme"

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

  const [locale, messages, t, appearance, initialTheme] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("nav"),
    getServerAppearance(),
    getServerThemePreference(),
  ])

  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [{ title: t("overview"), url: "/", icon: <LayoutDashboard /> }],
    },
  ])

  return (
    <html
      lang={locale}
      className={cn(fontClassName, appearance === "dark" && "dark")}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DashboardProviders initialTheme={initialTheme}>
            <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
          </DashboardProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
