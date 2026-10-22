import "./styles.css"
import { ConsentShell } from "@eleva/consent/shell"
import { fontClassName } from "@eleva/ui/fonts"
import { cn } from "@eleva/ui/lib/utils"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { DashboardProviders } from "@eleva/dashboard/dashboard-providers"
import {
  getServerAppearance,
  getServerThemePreference,
} from "@eleva/dashboard/server-theme"

export const metadata = {
  title: "Eleva Academy",
  description: "Create and manage online courses on Eleva.care",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [locale, messages, appearance, initialTheme] = await Promise.all([
    getLocale(),
    getMessages(),
    getServerAppearance(),
    getServerThemePreference(),
  ])

  return (
    <html
      lang={locale}
      className={cn(fontClassName, appearance === "dark" && "dark")}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ConsentShell>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <DashboardProviders initialTheme={initialTheme}>
              {children}
            </DashboardProviders>
          </NextIntlClientProvider>
        </ConsentShell>
      </body>
    </html>
  )
}
