import { notFound } from "next/navigation"

import { locales, type Locale } from "@eleva/config/i18n-locales"
import { getDashboardMessages } from "@eleva/dashboard/messages"

import { IntlProvider } from "./intl-provider"

/**
 * A page that fails on purpose, so `e2e/route-error.spec.ts` can prove the
 * shared error page in a real browser. Not a product surface.
 */
export default async function RouteErrorFixtureLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const messages = await getDashboardMessages(locale as Locale)
  return (
    <IntlProvider
      locale={locale}
      timeZone="Europe/Lisbon"
      messages={{ routeStates: messages.routeStates }}
    >
      <main className="mx-auto min-h-svh max-w-5xl p-6">{children}</main>
    </IntlProvider>
  )
}
