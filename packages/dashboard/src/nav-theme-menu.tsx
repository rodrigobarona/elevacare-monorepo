"use client"

import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@eleva/icons"
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@eleva/ui/components/dropdown-menu"
import {
  isThemePreference,
  persistThemeCookie,
  type ThemePreference,
} from "@eleva/config/theme"

const THEME_OPTIONS: {
  value: ThemePreference
  icon: typeof SunIcon
  labelKey: "themeLight" | "themeDark" | "themeSystem"
}[] = [
  { value: "light", icon: SunIcon, labelKey: "themeLight" },
  { value: "dark", icon: MoonIcon, labelKey: "themeDark" },
  { value: "system", icon: MonitorIcon, labelKey: "themeSystem" },
]

export function NavThemeMenu() {
  const t = useTranslations("shell")
  const { theme, setTheme } = useTheme()

  const active = theme ?? "system"

  function selectTheme(value: ThemePreference) {
    setTheme(value)
    persistThemeCookie(value, window.location.host)
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 py-1">
        <SunIcon className="size-4" />
        {t("theme")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-36">
        {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            className="py-1"
            onClick={() => {
              if (!isThemePreference(value)) return
              selectTheme(value)
            }}
          >
            <Icon className="size-4" />
            <span className="flex-1">{t(labelKey)}</span>
            {active === value ? (
              <CheckIcon className="size-4 text-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
