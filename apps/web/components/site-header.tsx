import { getTranslations } from "next-intl/server"
import { getAuthUser } from "@eleva/auth/server"

import { Button } from "@eleva/ui/components/button"
import { Link } from "@/i18n/navigation"
import { LanguageSwitcher } from "@/components/language-switcher"
import { MobileNav } from "@/components/mobile-nav"
import { UserMenu } from "@/components/user-menu"

function getInitials(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName)
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName[0]!.toUpperCase()
  return email[0]!.toUpperCase()
}

export async function SiteHeader() {
  const t = await getTranslations()
  const user = await getAuthUser()

  const links: Array<{
    href: "/" | "/about" | "/experts" | "/become-partner"
    key: string
  }> = [
    { href: "/", key: "nav.home" },
    { href: "/experts", key: "nav.experts" },
    { href: "/about", key: "nav.about" },
    { href: "/become-partner", key: "nav.becomePartner" },
  ]

  const userProps = user
    ? {
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email,
        email: user.email,
        initials: getInitials(user.firstName, user.lastName, user.email),
      }
    : null

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only bg-primary text-primary-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-heading text-lg font-semibold tracking-tight text-foreground"
          >
            {t("site.name")}
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          {userProps ? (
            <div className="hidden md:block">
              <UserMenu {...userProps} />
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                asChild
              >
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/signin">{t("nav.signin")}</a>
              </Button>
              <Button size="sm" className="hidden md:inline-flex" asChild>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/signup">{t("nav.signup")}</a>
              </Button>
            </>
          )}
          <MobileNav
            links={links.map((link) => ({
              href: link.href,
              label: t(link.key),
            }))}
            siteName={t("site.name")}
            menuLabel={t("nav.menu")}
            signinLabel={t("nav.signin")}
            signupLabel={t("nav.signup")}
            user={userProps}
            dashboardLabel={t("nav.dashboard")}
            settingsLabel={t("nav.settings")}
            signoutLabel={t("nav.signout")}
          />
        </div>
      </div>
    </header>
  )
}
