import { Suspense } from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { requestHasSessionCookie } from "@eleva/auth/credentials"
import { Logo, LogoMark } from "@eleva/ui/components/brand"
import { Link } from "@/i18n/navigation"
import { PUBLIC_SITE_NAV } from "@/lib/public-site-nav"
import { AuthHeaderPlaceholder } from "./auth-header-placeholder"
import { LanguageSwitcher } from "./language-switcher"
import { MobileNavMenu } from "./mobile-nav-menu"
import { SignedOutButtons } from "./signed-out-buttons"
import { SiteHeaderAuthSlot } from "./site-header-auth-slot"

/**
 * Shared public-site header. The auth slot streams in behind Suspense; the
 * fallback is chosen from a non-empty session cookie so logged-in visitors
 * see an avatar placeholder instead of login buttons that swap out a moment
 * later.
 */
export async function SiteHeader() {
  const t = await getTranslations("nav")
  const jar = await cookies()
  const hasSessionCookie = requestHasSessionCookie(jar)
  const nav = PUBLIC_SITE_NAV

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" aria-label="Eleva.care" className="shrink-0 rounded-sm">
          <LogoMark className="size-7 sm:hidden" />
          <Logo className="hidden h-6 sm:block" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden rounded-full px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
            >
              {t(item.labelKey)}
            </Link>
          ))}
          <MobileNavMenu
            label={t("more")}
            items={nav.map((item) => ({
              href: item.href,
              label: t(item.labelKey),
            }))}
          />
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
        </div>
      </nav>
    </header>
  )
}
