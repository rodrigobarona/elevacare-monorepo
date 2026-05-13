"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@eleva/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@eleva/ui/components/sheet"
import { LanguageSwitcher } from "@/components/language-switcher"

interface MobileNavProps {
  links: Array<{ href: string; label: string }>
  siteName: string
  user: { name: string; initials: string } | null
}

export function MobileNav({ links, siteName, user }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const t = useTranslations("nav")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">{t("menu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">{siteName}</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-border/60 pt-4">
          <LanguageSwitcher />
        </div>
        {!user && (
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/signin" onClick={() => setOpen(false)}>
                {t("signin")}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup" onClick={() => setOpen(false)}>
                {t("signup")}
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
