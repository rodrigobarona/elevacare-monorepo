import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { CookieSettingsLink } from "@eleva/consent/cookie-settings-link"
import { gatewayMarketingPath } from "./gateway-marketing-url"
import { getFooterCopy } from "./footer-copy"

const LINK_CLASS =
  "inline-block rounded-sm py-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"

/**
 * The footer inside booking and checkout: the links a member may need
 * before paying (terms, privacy, health data, payments, complaints, the
 * complaints book, help) and nothing that pulls her out of the booking.
 * The full site footer stays on every other public page.
 */
function NewTab({ label }: { label: string }) {
  return <span className="sr-only"> ({label})</span>
}

export function CheckoutSiteFooter({ locale: rawLocale }: { locale: string }) {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const t = getFooterCopy(locale)
  const year = new Date().getFullYear().toString()
  const href = (path: string) => gatewayMarketingPath(locale, path)

  return (
    <footer className="border-t py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 text-xs text-muted-foreground sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p>{t.rights(year)}</p>
          <p className="text-balance">{t.operator}</p>
        </div>
        {/* Links open in a new tab: reading the terms must never cost her
            the booking she is in the middle of. */}
        <nav aria-label={t.legalAndHelp} className="lg:max-w-xl">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:justify-end">
            <li>
              <a
                href={href("/legal/terms")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.terms}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href={href("/legal/privacy")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.privacy}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href={href("/legal/health-data")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.healthData}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href={href("/legal/payments")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.payments}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href={href("/legal/complaints")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.complaints}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href="https://www.livroreclamacoes.pt/inicio"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {t.complaintsBook}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href={href("/legal/accessibility")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.accessibility}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <a
                href={href("/docs/members")}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.helpCenter}
                <NewTab label={t.newTab} />
              </a>
            </li>
            <li>
              <CookieSettingsLink className={LINK_CLASS}>
                {t.cookieSettings}
              </CookieSettingsLink>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
