import "@eleva/ui/globals.css"
import { redirect } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { getSession } from "@eleva/auth/server"

const ACCOUNT_SIGNIN_URL =
  process.env.ACCOUNT_URL || "https://account.eleva.care"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eleva.care"

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
    redirect(`${ACCOUNT_SIGNIN_URL}/signin`)
  }

  if (!session.capabilities.includes("audit:view_all")) {
    redirect(`${APP_URL}/${session.orgSlug}`)
  }

  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
