import "./styles.css"
import { fontClassName } from "@eleva/ui/fonts"

export const metadata = {
  title: "Eleva.care — Docs",
  description: "Public documentation and compliance references",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={fontClassName} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
