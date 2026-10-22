import { Suspense } from "react"
import { cookies } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { requestHasSessionCookie } from "@eleva/auth/credentials"
import { defaultLocale, isLocale } from "@eleva/config/i18n"
import { Logo, LogoMark } from "@eleva/ui/components/brand"
import { Link } from "@/i18n/navigation"
import { SiteMegaMenu } from "@eleva/site-chrome/site-mega-menu"
import { SiteMobileNav } from "@eleva/site-chrome/site-mobile-nav"
import { buildNavCopyRecords } from "@eleva/site-chrome/nav-copy"
import {
  SiteNavMobileGroups,
  SiteNavPanel,
} from "@eleva/site-chrome/site-nav-panels"
import { PUBLIC_SITE_NAV } from "@/lib/public-site-nav"
import { AuthHeaderPlaceholder } from "./auth-header-placeholder"
import { LanguageSwitcher } from "./language-switcher"
import { SignedOutButtons } from "./signed-out-buttons"
import { SiteHeaderAuthSlot } from "./site-header-auth-slot"
import { WebPublicNavigationProvider } from "./web-public-navigation-provider"

/**
 * Shared public-site header. The auth slot streams in behind Suspense; the
 * fallback is chosen from a non-empty session cookie so logged-in visitors
 * see an avatar placeholder instead of login buttons that swap out a moment
 * later.
 */
export async function SiteHeader() {
  const [t, tHome, requestLocale, jar] = await Promise.all([
    getTranslations("nav"),
    getTranslations("home"),
    getLocale(),
    cookies(),
  ])
  const hasSessionCookie = requestHasSessionCookie(jar)
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale
  const copy = buildNavCopyRecords(
    (key) => t(key),
    (key) => tHome(key)
  )

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" aria-label="Eleva.care" className="shrink-0 rounded-sm">
          <LogoMark className="size-7 sm:hidden" />
          <Logo className="hidden h-6 sm:block" />
        </Link>
        <WebPublicNavigationProvider>
          <div className="flex min-w-0 flex-1 items-center pl-4">
            <SiteMegaMenu
              items={PUBLIC_SITE_NAV.map((menu) => ({
                id: menu.id,
                label: t(`menu.${menu.id}.trigger`),
                matches: menu.matches,
                panel: <SiteNavPanel menu={menu} copy={copy} locale={locale} />,
              }))}
            />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Suspense
              fallback={
                hasSessionCookie ? (
                  <AuthHeaderPlaceholder />
                ) : (
                  <SignedOutButtons
                    loginLabel={t("login")}
                    getStartedLabel={t("getStarted")}
                  />
                )
              }
            >
              <SiteHeaderAuthSlot />
            </Suspense>
            <SiteMobileNav openLabel={t("menu.open")} title={t("menu.label")}>
              <SiteNavMobileGroups
                menus={PUBLIC_SITE_NAV}
                copy={copy}
                locale={locale}
              />
            </SiteMobileNav>
          </div>
        </WebPublicNavigationProvider>
      </nav>
    </header>
  )
}
