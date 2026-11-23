import type { ReactNode } from "react"
import { LEGAL_SLUGS, type LegalSlug } from "@eleva/config/legal-slugs"
import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { COMMUNITY_EXTERNAL_LINKS } from "@eleva/config/public-site-parity"
import { CookieSettingsLink } from "@eleva/consent/cookie-settings-link"
import { Logo } from "@eleva/ui/components/brand"
import { gatewayMarketingPath } from "./gateway-marketing-url"
import { getFooterCopy } from "./footer-copy"

const LEGAL_LABEL: Record<
  LegalSlug,
  | "terms"
  | "privacy"
  | "healthData"
  | "aiProcessing"
  | "cookies"
  | "payments"
  | "expertAgreement"
  | "accessibility"
  | "complaints"
> = {
  terms: "terms",
  privacy: "privacy",
  "health-data": "healthData",
  "ai-processing": "aiProcessing",
  cookies: "cookies",
  payments: "payments",
  "expert-agreement": "expertAgreement",
  accessibility: "accessibility",
  complaints: "complaints",
}

// Each link is at least 24px tall (WCAG 2.5.8); the list keeps its rhythm.
const LINK_CLASS =
  "inline-flex min-h-7 w-fit items-center text-base text-muted-foreground transition-colors hover:text-foreground"

function FooterColumn({
  title,
  testId,
  children,
}: {
  title: string
  testId?: string
  children: ReactNode
}) {
  return (
    <nav
      aria-label={title}
      data-testid={testId}
      className="flex flex-col gap-1"
    >
      <p className="mb-1.5 text-base font-medium text-foreground">{title}</p>
      {children}
    </nav>
  )
}

export function PublicSiteFooter({ locale: rawLocale }: { locale: string }) {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const t = getFooterCopy(locale)
  const year = new Date().getFullYear().toString()
  const href = (path: string) => gatewayMarketingPath(locale, path)

  return (
    <footer className="border-t px-4 pt-16 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex max-w-xs flex-col gap-4">
            <a
              href={href("/")}
              aria-label="Eleva.care"
              className="w-fit rounded-sm"
            >
              <Logo className="h-7" />
            </a>
            <p className="text-base text-pretty text-muted-foreground">
              {t.tagline}
            </p>
          </div>
          <FooterColumn title={t.solutions} testId="footer-solutions">
            <a href={href("/about")} className={LINK_CLASS}>
              {t.about}
            </a>
            <a href={href("/history")} className={LINK_CLASS}>
              {t.story}
            </a>
            <a href={href("/become-expert")} className={LINK_CLASS}>
              {t.becomeExpert}
            </a>
            <a href={href("/for-clinics")} className={LINK_CLASS}>
              {t.forClinics}
            </a>
          </FooterColumn>
          <FooterColumn title={t.legal}>
            {LEGAL_SLUGS.map((slug) => (
              <a
                key={slug}
                href={href(`/legal/${slug}`)}
                className={LINK_CLASS}
              >
                {t[LEGAL_LABEL[slug]]}
              </a>
            ))}
            <a
              href="https://www.livroreclamacoes.pt/inicio"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {t.complaintsBook}
            </a>
            <a href={href("/trust")} className={LINK_CLASS}>
              {t.trustHub}
            </a>
            <a href={href("/evidence-based-care")} className={LINK_CLASS}>
              {t.evidenceBasedCare}
            </a>
            <a href={href("/credits")} className={LINK_CLASS}>
              {t.credits}
            </a>
            <CookieSettingsLink className={LINK_CLASS}>
              {t.cookieSettings}
            </CookieSettingsLink>
          </FooterColumn>
          <FooterColumn title={t.community} testId="footer-community">
            <a
              href={href("/newsletter")}
              data-testid="footer-community-newsletter"
              className={LINK_CLASS}
            >
              {t.newsletter}
            </a>
            <a
              href={href("/podcast")}
              data-testid="footer-community-podcast"
              className={LINK_CLASS}
            >
              {t.podcast}
            </a>
            <a
              href={href("/community")}
              data-testid="footer-community-hub"
              className={LINK_CLASS}
            >
              {t.community}
            </a>
            <a
              href={href("/docs")}
              data-testid="footer-community-help"
              className={LINK_CLASS}
            >
              {t.helpCenter}
            </a>
            {COMMUNITY_EXTERNAL_LINKS.map((link) => (
              <a
                key={link.id}
                data-testid={`footer-community-${link.id}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {t[link.id]}
              </a>
            ))}
          </FooterColumn>
        </div>
        {/* The page signs off with the wordmark at full width. */}
        <Logo aria-hidden title="" className="h-auto w-full" />
        {/* Who runs the site: legal name, tax number and registered address
            (e-Commerce Directive, art. 5). */}
        <div className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p>{t.rights(year)}</p>
          <p className="text-pretty sm:max-w-xl sm:text-right">{t.operator}</p>
        </div>
      </div>
    </footer>
  )
}
