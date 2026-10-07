import { Suspense } from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { SESSION_COOKIE_NAMES } from "@eleva/auth/credentials"
import { Logo, LogoMark } from "@eleva/ui/components/brand"
import { Link } from "@/i18n/navigation"
import { AuthHeaderPlaceholder } from "./auth-header-placeholder"
import { LanguageSwitcher } from "./language-switcher"
import { SignedOutButtons } from "./signed-out-buttons"
import { SiteHeaderAuthSlot } from "./site-header-auth-slot"

type NavItem = {
  href: string
  labelKey: string
}

interface SiteHeaderProps {
  nav?: NavItem[]
}

/**
 * Marketing site header. The auth slot streams in behind Suspense; the
 * fallback is chosen from the session cookie so logged-in visitors see
 * an avatar placeholder instead of login buttons that swap out a moment
 * later.
 */
export async function SiteHeader({ nav = [] }: SiteHeaderProps) {
  const t = await getTranslations("nav")
  const jar = await cookies()
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => jar.has(name))

  return (
    <header className="border-b px-4 py-4 sm:px-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link href="/" className="shrink-0 rounded-sm">
          <LogoMark className="size-7 sm:hidden" />
          <Logo className="hidden h-6 sm:block" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {nav.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${index === 0 ? "inline-flex" : "hidden md:inline-flex"} text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground`}
            >
              {t(item.labelKey)}
            </Link>
          ))}
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
