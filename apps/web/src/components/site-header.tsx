import { Suspense } from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { AuthHeaderPlaceholder } from "./auth-header-placeholder"
import { LanguageSwitcher } from "./language-switcher"
import { SignedOutButtons } from "./signed-out-buttons"
import { SiteHeaderAuthSlot } from "./site-header-auth-slot"

const SESSION_COOKIE = process.env.WORKOS_COOKIE_NAME ?? "wos-session"

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
  const hasSessionCookie = (await cookies()).has(SESSION_COOKIE)

  return (
    <header className="border-b px-6 py-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          eleva<span className="text-primary">.care</span>
        </Link>
        <div className="flex items-center gap-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
