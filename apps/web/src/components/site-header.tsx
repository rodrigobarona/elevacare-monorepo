import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
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
 * Marketing site header. The auth-aware slot (signin buttons vs user
 * menu) is wrapped in Suspense so the page shell + nav links stream
 * down before WorkOS session resolution finishes. Most marketing
 * visitors are logged-out, so the SignedOutButtons fallback is the
 * correct steady state -- meaning clicking "Sign in" is interactive
 * the instant the header paints, with no perceived auth latency.
 */
export async function SiteHeader({ nav = [] }: SiteHeaderProps) {
  const t = await getTranslations("nav")

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
              <SignedOutButtons
                signInLabel={t("signin")}
                signUpLabel={t("signup")}
              />
            }
          >
            <SiteHeaderAuthSlot />
          </Suspense>
        </div>
      </nav>
    </header>
  )
}
