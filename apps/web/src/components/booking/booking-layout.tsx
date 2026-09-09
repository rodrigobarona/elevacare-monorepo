import type { ReactNode } from "react"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function BookingLayout({
  children,
  backHref,
  backLabelKey = "experts",
}: {
  children: ReactNode
  backHref: string
  backLabelKey?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader
        nav={[
          { href: backHref, labelKey: backLabelKey },
          { href: "/", labelKey: "home" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
