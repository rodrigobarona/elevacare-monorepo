"use client"

import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { Monitor, Moon, Sun } from "lucide-react"
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
  icon: typeof Sun
  labelKey: "themeLight" | "themeDark" | "themeSystem"
}[] = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
  { value: "system", icon: Monitor, labelKey: "themeSystem" },
]

export function NavThemeMenu() {
  const t = useTranslations("shell")
  const { theme, setTheme } = useTheme()

  const active = theme ?? "system"

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Sun className="mr-2 size-4" />
        {t("theme")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuLabel>{t("themeLabel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(value) => {
            if (!isThemePreference(value)) return
            setTheme(value)
            persistThemeCookie(value, window.location.host)
          }}
        >
          {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="mr-2 size-4" />
              {t(labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
