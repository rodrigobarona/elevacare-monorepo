import { getLocale } from "next-intl/server"
import { guardSession } from "@eleva/auth"
import { ElevaWidgetsProvider } from "@/components/workos-widgets-provider"

import "@radix-ui/themes/styles.css"
import "@workos-inc/widgets/styles.css"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await guardSession()

  const locale = await getLocale()

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <ElevaWidgetsProvider locale={locale}>{children}</ElevaWidgetsProvider>
    </div>
  )
}
