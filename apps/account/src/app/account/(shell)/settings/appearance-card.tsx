"use client"

import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import {
  isThemePreference,
  persistThemeCookie,
  themes,
  type ThemePreference,
} from "@eleva/config/theme"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  SettingsFieldset,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"

/** Light, dark or the device's setting; applies as soon as it is picked. */
export function AppearanceCard({
  initialTheme,
}: {
  initialTheme: ThemePreference
}) {
  const t = useTranslations("profile.appearance")
  const { theme, setTheme } = useTheme()
  const selected = theme && isThemePreference(theme) ? theme : initialTheme

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SettingsFieldsetTitle as="h2" id="appearance-title">
            {t("title")}
          </SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
        </div>
        <Select
          className="w-full sm:w-auto"
          aria-labelledby="appearance-title"
          selectedKey={selected}
          onSelectionChange={(key) => {
            if (typeof key !== "string" || !isThemePreference(key)) return
            setTheme(key)
            persistThemeCookie(key, window.location.host)
          }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {themes.map((value) => (
              <SelectItem key={value} id={value} textValue={t(value)}>
                {t(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus>{t("footer")}</SettingsFieldsetStatus>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
