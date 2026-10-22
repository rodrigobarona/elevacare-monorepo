import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { Logo } from "@eleva/ui/components/brand"
import { getFooterCopy, type FooterCopy } from "./footer-copy"
import { gatewayMarketingPath } from "./gateway-marketing-url"

const STRIP_LINKS = [
  { href: "/newsletter", labelKey: "newsletter" },
  { href: "/evidence-based-care", labelKey: "evidenceBasedCare" },
  { href: "/become-expert", labelKey: "becomeExpert" },
  { href: "/for-clinics", labelKey: "forClinics" },
] as const satisfies ReadonlyArray<{
  href: string
  labelKey: keyof FooterCopy
}>

export function DocsMarketingStrip({ locale: rawLocale }: { locale: string }) {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const home = gatewayMarketingPath(locale, "/")
  const copy = getFooterCopy(locale)

  return (
    <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
        <a href={home} className="inline-flex items-center gap-2 rounded-sm">
          <Logo className="h-4" />
          <span className="font-medium text-foreground">Eleva.care</span>
        </a>
        <nav aria-label="Eleva.care" className="flex flex-wrap gap-3">
          {STRIP_LINKS.map((link) => (
            <a
              key={link.href}
              href={gatewayMarketingPath(locale, link.href)}
              className="transition-colors hover:text-foreground"
            >
              {copy[link.labelKey]}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
