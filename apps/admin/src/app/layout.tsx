import "./styles.css"
import { redirect } from "next/navigation"
import { fontClassName } from "@eleva/ui/fonts"
import { cn } from "@eleva/ui/lib/utils"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { loadUserWorkspaces } from "@eleva/dashboard/account-menu-server"
import { DashboardProviders } from "@eleva/dashboard/dashboard-providers"
import {
  getServerAppearance,
  getServerThemePreference,
} from "@eleva/dashboard/server-theme"
import { StaffEntry } from "@/components/staff-entry"

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

  // Staff rights come from the active workspace. Someone who holds a staff
  // membership but is working elsewhere confirms before switching to it.
  const isStaff = session.capabilities.includes("audit:view_all")
  const staffWorkspace = isStaff
    ? null
    : (await loadUserWorkspaces(session.user.id, session.orgId)).find(
        (workspace) => workspace.orgType === "staff"
      )
  if (!isStaff && !staffWorkspace) {
    redirect(`${APP_URL}/${session.orgSlug}`)
  }

  const [locale, messages, t, appearance, initialTheme] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("nav"),
    getServerAppearance(),
    getServerThemePreference(),
  ])

  const content = staffWorkspace ? (
    <StaffEntry
      staffOrgId={staffWorkspace.orgId}
      backHref={`${GATEWAY_URL}/dashboard`}
    />
  ) : (
    <DashboardShell
      config={await buildDashboardConfig(
        session,
        [
          {
            items: [
              { title: t("overview"), url: "/", icon: "SquaresFourIcon" },
              { title: t("partners"), url: "/partners", icon: "ShieldIcon" },
            ],
          },
        ],
        { enableOrgSwitcher: false }
      )}
    >
      {children}
    </DashboardShell>
  )

  return (
    <html
      lang={locale}
      className={cn(fontClassName, appearance === "dark" && "dark")}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DashboardProviders initialTheme={initialTheme}>
            {content}
          </DashboardProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
