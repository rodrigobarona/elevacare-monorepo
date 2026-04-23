import { Geist, Geist_Mono, DM_Sans, Lora } from "next/font/google"

import "@eleva/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@eleva/ui/lib/utils";

const loraHeading = Lora({subsets:['latin'],variable:'--font-heading'});

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", dmSans.variable, loraHeading.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
