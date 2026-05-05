"use client"

import { useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { Globe } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { locales, type Locale } from "@eleva/config/i18n"
import { usePathname, useRouter } from "@/i18n/navigation"

export function LanguageSwitcher() {
  const t = useTranslations("locale")
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function switchTo(next: Locale) {
    if (next === locale) return
    const search = searchParams.toString()
    const target = search ? `${pathname}?${search}` : pathname
    startTransition(() => {
      router.replace(target, { locale: next })
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("switchLabel")}
          disabled={isPending}
        >
          <Globe />
          <span className="ml-1 text-xs uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("switchLabel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => switchTo(l)}
            data-active={l === locale}
            className="data-[active=true]:font-semibold"
          >
            {t(l)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
