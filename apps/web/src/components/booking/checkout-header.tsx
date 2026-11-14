import { getLocale, getTranslations } from "next-intl/server"
import { defaultLocale, isLocale } from "@eleva/config/i18n"
import { ShieldCheckIcon, QuestionIcon } from "@eleva/icons"
import { Logo, LogoMark } from "@eleva/ui/components/brand"
import { gatewayMarketingPath } from "@eleva/site-chrome/gateway-marketing-url"
import { Link } from "@/i18n/navigation"
import { LanguageSwitcher } from "../language-switcher"

/**
 * Header for booking and checkout. No site navigation, nothing to sell:
 * the logo, a calm "secure booking" mark, help and the language. The
 * member's way back to the expert is the "About {name}" link in the
 * booking summary.
 */
export async function CheckoutHeader() {
  const [t, requestLocale] = await Promise.all([
    getTranslations("booking.chrome"),
    getLocale(),
  ])
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale

  return (
    <header className="border-b border-border/60 bg-background px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link href="/" aria-label="Eleva.care" className="shrink-0 rounded-sm">
          <LogoMark className="size-7 sm:hidden" />
          <Logo className="hidden h-6 sm:block" />
        </Link>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheckIcon aria-hidden className="size-4 text-primary" />
          {t("secure")}
        </p>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={gatewayMarketingPath(locale, "/docs/members")}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <QuestionIcon aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t("help")}</span>
            <span className="sr-only sm:hidden">{t("help")}</span>
          </a>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
