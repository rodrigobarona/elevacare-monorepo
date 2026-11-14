"use client"

import { useLocale, useTranslations } from "next-intl"
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

export function LanguageSwitcher({
  query,
  showCode = false,
}: {
  /**
   * Query string to keep (e.g. the booking funnel's mode and time). Read by
   * the caller, so pages that don't need it never call useSearchParams.
   */
  query?: string
  /** Show the current language code next to the globe. */
  showCode?: boolean
} = {}) {
  const locale = useLocale()
  const t = useTranslations("nav")
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSelect(nextLocale: Locale) {
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        locale: nextLocale,
      })
    })
  }

  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size={showCode ? "sm" : "icon-sm"}
        aria-label={t("changeLanguage")}
        isDisabled={isPending}
      >
        <GlobeIcon className="size-4" />
        {showCode ? (
          <span aria-hidden className="text-xs font-medium uppercase">
            {locale}
          </span>
        ) : null}
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
