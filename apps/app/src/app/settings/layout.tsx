import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { AppShell } from "@/components/app-shell"
import { ElevaWidgetsProvider } from "@/components/workos-widgets-provider"

import "@radix-ui/themes/styles.css"
import "@workos-inc/widgets/styles.css"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/signin")

  const locale = await getLocale()

  return (
    <AppShell session={session}>
      <ElevaWidgetsProvider locale={locale}>{children}</ElevaWidgetsProvider>
    </AppShell>
  )
}
