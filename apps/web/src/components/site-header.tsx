import { getAuthUser } from "@eleva/auth/server"
import { Button } from "@eleva/ui/components/button"
import { Avatar, AvatarFallback } from "@eleva/ui/components/avatar"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { LanguageSwitcher } from "./language-switcher"
import { UserMenu } from "./user-menu"

type NavItem = {
  href: string
  labelKey: string
}

interface SiteHeaderProps {
  nav?: NavItem[]
}

export async function SiteHeader({ nav = [] }: SiteHeaderProps) {
  const t = await getTranslations("nav")

  let user: {
    firstName: string | null
    lastName: string | null
    email: string
  } | null = null
  try {
    user = await getAuthUser()
  } catch {
    // Not authenticated -- silently fall through to logged-out state.
    // This is expected on the marketing site when no WorkOS cookie exists.
  }

  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]]
        .filter(Boolean)
        .join("")
        .toUpperCase() ||
      user.email[0]?.toUpperCase() ||
      "?"
    : null

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
          {user ? (
            <UserMenu
              initials={initials!}
              firstName={user.firstName}
              email={user.email}
              dashboardLabel={t("dashboard")}
              signOutLabel={t("signout")}
              dashboardUrl="/auth-redirect"
              signOutUrl="/logout"
            />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <a href="/signin">{t("signin")}</a>
              </Button>
              <Button size="sm" asChild>
                <a href="/signup">{t("signup")}</a>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
