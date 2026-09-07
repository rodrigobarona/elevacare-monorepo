"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { locales, localeNames, type Locale } from "@eleva/config/i18n"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { GlobeIcon, CheckIcon } from "@eleva/icons"
import { useTransition } from "react"

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSelect(nextLocale: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Change language"
        isDisabled={isPending}
      >
        <GlobeIcon className="size-4" />
      </Button>
      <DropdownMenu placement="bottom end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            id={l}
            textValue={localeNames[l]}
            onAction={() => handleSelect(l)}
          >
            {l === locale && <CheckIcon className="size-3.5" />}
            <span className={l === locale ? "font-medium" : ""}>
              {localeNames[l]}
            </span>
            <span className="ml-auto text-xs text-muted-foreground uppercase">
              {l}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
