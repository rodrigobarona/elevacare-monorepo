import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { CookieSettingsLink } from "@eleva/consent/cookie-settings-link"
import { gatewayMarketingPath } from "./gateway-marketing-url"
import { getFooterCopy } from "./footer-copy"

const LINK_CLASS =
  "rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * The footer inside booking and checkout: the links a member may need
 * before paying (terms, privacy, health data, payments, complaints, the
 * complaints book, help) and nothing that pulls her out of the booking.
 * The full site footer stays on every other public page.
 */
export function CheckoutSiteFooter({ locale: rawLocale }: { locale: string }) {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const t = getFooterCopy(locale)
  const year = new Date().getFullYear().toString()
  const href = (path: string) => gatewayMarketingPath(locale, path)

  return (
    <footer className="border-t px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p>{t.rights(year)}</p>
          <p>{t.operator}</p>
        </div>
        <nav aria-label={t.legal}>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li>
              <a href={href("/legal/terms")} className={LINK_CLASS}>
                {t.terms}
              </a>
            </li>
            <li>
              <a href={href("/legal/privacy")} className={LINK_CLASS}>
                {t.privacy}
              </a>
            </li>
            <li>
              <a href={href("/legal/health-data")} className={LINK_CLASS}>
                {t.healthData}
              </a>
            </li>
            <li>
              <a href={href("/legal/payments")} className={LINK_CLASS}>
                {t.payments}
              </a>
            </li>
            <li>
              <a href={href("/legal/complaints")} className={LINK_CLASS}>
                {t.complaints}
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
              </a>
            </li>
            <li>
              <a href={href("/docs/members")} className={LINK_CLASS}>
                {t.helpCenter}
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
