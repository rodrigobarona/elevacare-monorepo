import { getTranslations } from "next-intl/server"
import { Menu } from "lucide-react"

import { Button } from "@eleva/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@eleva/ui/components/sheet"
import { Link } from "@/i18n/navigation"
import { LanguageSwitcher } from "@/components/language-switcher"

export async function SiteHeader() {
  const t = await getTranslations()

  const links: Array<{
    href: "/" | "/about" | "/experts" | "/become-partner"
    key: string
  }> = [
    { href: "/", key: "nav.home" },
    { href: "/experts", key: "nav.experts" },
    { href: "/about", key: "nav.about" },
    { href: "/become-partner", key: "nav.becomePartner" },
  ]

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
          {/* signin/signup live in apps/app — cross-app navigation, not a Next.js page in apps/web */}
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
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("nav.menu")}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{t("site.name")}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-muted"
                  >
                    {t(link.key)}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3 border-t border-border/60 p-4">
                <LanguageSwitcher />
                <Button variant="outline" asChild>
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/signin">{t("nav.signin")}</a>
                </Button>
                <Button asChild>
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/signup">{t("nav.signup")}</a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
