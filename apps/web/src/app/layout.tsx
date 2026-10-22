import "./styles.css"
import { ConsentShell } from "@eleva/consent/shell"
import { getLocale } from "next-intl/server"
import { fontClassName } from "@eleva/ui/fonts"

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()

  return (
    <html lang={locale} className={fontClassName} suppressHydrationWarning>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <ConsentShell>{children}</ConsentShell>
      </body>
    </html>
  )
}
