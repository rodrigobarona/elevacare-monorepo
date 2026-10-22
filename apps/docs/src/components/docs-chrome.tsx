import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { DocsMarketingStrip } from "@eleva/site-chrome/docs-marketing-strip"
import { gatewayMarketingPath } from "@eleva/site-chrome/gateway-marketing-url"
import { PublicSiteFooter } from "@eleva/site-chrome/public-site-footer"
import { Logo } from "@eleva/ui/components/brand"
import Link from "next/link"
import type { ReactNode } from "react"
import { getDocsChromeCopy } from "@/lib/docs-chrome-copy"
import { DocsSearch } from "./docs-search"

const PORTAL_IDS = ["members", "experts", "clinics"] as const

export function DocsChrome({
  locale,
  localePrefix,
  children,
}: {
  locale: string
  localePrefix: string
  children: ReactNode
}) {
  const contentLocale: Locale = isLocale(locale) ? locale : defaultLocale
  const copy = getDocsChromeCopy(contentLocale)
  const evidenceHref = gatewayMarketingPath(
    contentLocale,
    "/evidence-based-care"
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <DocsMarketingStrip locale={locale} />
      <header className="border-b bg-background/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <Link href={localePrefix || "/"} className="rounded-sm">
              <Logo className="h-6" />
            </Link>
            <Link
              href={localePrefix || "/"}
              className="text-sm font-medium text-foreground"
            >
              {copy.helpCenter}
            </Link>
            <DocsSearch localePrefix={localePrefix} />
          </div>
          <nav
            aria-label={copy.portalsNavLabel}
            className="flex flex-wrap gap-3 text-sm text-muted-foreground"
          >
            {PORTAL_IDS.map((portalId) => (
              <Link
                key={portalId}
                href={`${localePrefix}/${portalId}`}
                className="transition-colors hover:text-foreground"
              >
                {copy.portals[portalId]}
              </Link>
            ))}
            <a
              href={evidenceHref}
              className="transition-colors hover:text-foreground"
            >
              {copy.evidenceBasedCare}
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:px-6">{children}</main>
      <PublicSiteFooter locale={locale} />
    </div>
  )
}
