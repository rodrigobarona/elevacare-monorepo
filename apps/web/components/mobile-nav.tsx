"use client"

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

interface MobileNavProps {
  links: Array<{
    href: "/" | "/about" | "/experts" | "/become-partner"
    label: string
  }>
  siteName: string
  menuLabel: string
  signinLabel: string
  signupLabel: string
}

export function MobileNav({
  links,
  siteName,
  menuLabel,
  signinLabel,
  signupLabel,
}: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={menuLabel}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{siteName}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-border/60 p-4">
          <LanguageSwitcher />
          <Button variant="outline" asChild>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/signin">{signinLabel}</a>
          </Button>
          <Button asChild>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/signup">{signupLabel}</a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
