import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <ElevaWidgetsProvider locale={locale}>{children}</ElevaWidgetsProvider>
    </div>
  )
}
