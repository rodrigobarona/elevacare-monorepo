import "./styles.css"
import { fontClassName } from "@eleva/ui/fonts"
import { cn } from "@eleva/ui/lib/utils"
import { Toaster } from "@eleva/ui/components/sonner"
import { ElevaThemeProvider } from "@eleva/dashboard"

export const metadata = {
  title: "Eleva — Product PoCs",
  description: "Interactive walkthrough gallery for product and UX review.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn(fontClassName)} suppressHydrationWarning>
      <body
        className="min-h-screen bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        <ElevaThemeProvider initialTheme="light">
          {children}
          <Toaster richColors position="top-center" />
        </ElevaThemeProvider>
      </body>
    </html>
  )
}
