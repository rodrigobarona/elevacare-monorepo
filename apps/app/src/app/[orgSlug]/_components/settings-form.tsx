"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { isIanaTimeZone } from "@eleva/api-client"
import { isLocale, locales, localeNames, type Locale } from "@eleva/config/i18n"
import {
  persistThemeCookie,
  isThemePreference,
  type ThemePreference,
} from "@eleva/config/theme"
import { Button } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import type { MeProfile } from "@eleva/api-client"
import { AvatarUpload } from "./avatar-upload"
import {
  updateLanguageAction,
  updateNotificationPreferencesAction,
  updateProfileAction,
} from "../actions"

const CHANNELS = ["email", "sms", "in_app"] as const
const CATEGORIES = [
  "booking",
  "reminder",
  "payment",
  "marketing",
  "system",
] as const

type Channel = (typeof CHANNELS)[number]
type Category = (typeof CATEGORIES)[number]

function prefKey(channel: Channel, category: Category): string {
  return `${channel}:${category}`
}

function listTimeZones(current: string | null): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC", "Europe/Lisbon", "Europe/Madrid", "America/Sao_Paulo"]
  const extra = current && isIanaTimeZone(current) ? [current] : []
  return Array.from(new Set([...extra, ...supported]))
}

interface SettingsFormProps {
  orgSlug: string
  profile: MeProfile
  apiBaseUrl: string
  preferredLocale: Locale | null
  initialTheme: ThemePreference
}

export function SettingsForm({
  orgSlug,
  profile,
  apiBaseUrl,
  preferredLocale,
  initialTheme,
}: SettingsFormProps) {
  const t = useTranslations("settings")
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(profile.name)
  const [timezone, setTimezone] = useState(profile.timezone ?? "Europe/Lisbon")
  const [locale, setLocale] = useState<Locale>(
    preferredLocale ?? profile.locale ?? "en"
  )
  const [profilePending, setProfilePending] = useState(false)
  const [languagePending, setLanguagePending] = useState(false)
  const [notifyPending, setNotifyPending] = useState(false)

  const timeZones = useMemo(
    () => listTimeZones(profile.timezone),
    [profile.timezone]
  )

  const initialEnabled = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const channel of CHANNELS) {
      for (const category of CATEGORIES) {
        const fallback = channel !== "sms" && category !== "marketing"
        map.set(prefKey(channel, category), fallback)
      }
    }
    for (const row of profile.preferences) {
      map.set(prefKey(row.channel, row.category), row.enabled)
    }
    return map
  }, [profile.preferences])

  const [enabled, setEnabled] = useState(initialEnabled)
  const quietFromProfile = profile.preferences.find(
    (row) => row.quietHoursStart && row.quietHoursEnd
  )
  const [quietEnabled, setQuietEnabled] = useState(
    Boolean(quietFromProfile?.quietHoursStart && quietFromProfile.quietHoursEnd)
  )
  const [quietStart, setQuietStart] = useState(
    quietFromProfile?.quietHoursStart ?? "22:00"
  )
  const [quietEnd, setQuietEnd] = useState(
    quietFromProfile?.quietHoursEnd ?? "07:00"
  )

  async function saveProfile() {
    setProfilePending(true)
    try {
      const result = await updateProfileAction(orgSlug, {
        name: name.trim(),
        timezone,
      })
      if (!result.ok) {
        toast.error(t("profile.error"))
        return
      }
      toast.success(t("profile.saved"))
      router.refresh()
    } finally {
      setProfilePending(false)
    }
  }

  async function saveLanguage() {
    setLanguagePending(true)
    try {
      const result = await updateLanguageAction(orgSlug, locale)
      if (!result.ok) {
        toast.error(t("language.error"))
        return
      }
      toast.success(t("language.saved"))
      router.refresh()
    } finally {
      setLanguagePending(false)
    }
  }

  function selectTheme(value: ThemePreference) {
    setTheme(value)
    persistThemeCookie(value, window.location.host)
    toast.success(t("theme.saved"))
  }

  async function saveNotifications() {
    setNotifyPending(true)
    try {
      const preferences = CHANNELS.flatMap((channel) =>
        CATEGORIES.map((category) => ({
          channel,
          category,
          enabled: enabled.get(prefKey(channel, category)) ?? false,
        }))
      )
      const result = await updateNotificationPreferencesAction(orgSlug, {
        timezone,
        quietHoursStart: quietEnabled ? quietStart : null,
        quietHoursEnd: quietEnabled ? quietEnd : null,
        preferences,
      })
      if (!result.ok) {
        toast.error(t("notifications.error"))
        return
      }
      toast.success(t("notifications.saved"))
      router.refresh()
    } finally {
      setNotifyPending(false)
    }
  }

  const activeTheme = (theme ?? initialTheme) as ThemePreference

  return (
    <div className="space-y-6">
      <AvatarUpload
        orgSlug={orgSlug}
        currentAvatarUrl={profile.avatarUrl}
        displayName={profile.name}
        email={profile.email}
        apiBaseUrl={apiBaseUrl}
      />

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("profile.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("profile.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {t("profile.email")}
              </p>
              <p className="text-sm">{profile.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">{t("profile.name")}</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-timezone">{t("profile.timezone")}</Label>
              <Select
                selectedKey={timezone}
                onSelectionChange={(key) => {
                  if (typeof key === "string" && isIanaTimeZone(key)) {
                    setTimezone(key)
                  }
                }}
              >
                <SelectTrigger
                  id="profile-timezone"
                  className="w-full max-w-md"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeZones.map((zone) => (
                    <SelectItem key={zone} id={zone} textValue={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("profile.footerHint")}
          </SettingsFieldsetStatus>
          <SettingsFieldsetActions>
            <Button size="sm" isDisabled={profilePending} onPress={saveProfile}>
              {profilePending ? t("profile.saving") : t("profile.save")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("language.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("language.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4">
            <Select
              aria-label={t("language.title")}
              selectedKey={locale}
              onSelectionChange={(key) => {
                if (typeof key === "string" && isLocale(key)) {
                  setLocale(key)
                }
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((loc) => (
                  <SelectItem key={loc} id={loc} textValue={localeNames[loc]}>
                    {localeNames[loc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("language.footerHint")}
          </SettingsFieldsetStatus>
          <SettingsFieldsetActions>
            <Button
              size="sm"
              isDisabled={languagePending}
              onPress={saveLanguage}
            >
              {languagePending ? t("profile.saving") : t("profile.save")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("theme.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("theme.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4">
            <Select
              aria-label={t("theme.title")}
              selectedKey={activeTheme}
              onSelectionChange={(key) => {
                if (typeof key === "string" && isThemePreference(key)) {
                  selectTheme(key)
                }
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="light" textValue={t("theme.light")}>
                  {t("theme.light")}
                </SelectItem>
                <SelectItem id="dark" textValue={t("theme.dark")}>
                  {t("theme.dark")}
                </SelectItem>
                <SelectItem id="system" textValue={t("theme.system")}>
                  {t("theme.system")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("theme.footerHint")}
          </SettingsFieldsetStatus>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>
            {t("notifications.title")}
          </SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("notifications.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-md text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium" />
                  {CHANNELS.map((channel) => (
                    <th
                      key={channel}
                      className="px-2 py-1 text-left font-medium"
                    >
                      {t(`notifications.channel.${channel}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((category) => (
                  <tr key={category}>
                    <th className="px-2 py-2 text-left font-medium">
                      {t(`notifications.category.${category}`)}
                    </th>
                    {CHANNELS.map((channel) => (
                      <td key={channel} className="px-2 py-2">
                        <CheckboxField
                          label={t(`notifications.channel.${channel}`)}
                          labelClassName="sr-only"
                          isSelected={
                            enabled.get(prefKey(channel, category)) ?? false
                          }
                          onChange={(selected) => {
                            setEnabled((current) => {
                              const next = new Map(current)
                              next.set(prefKey(channel, category), selected)
                              return next
                            })
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 space-y-3">
            <CheckboxField
              label={t("notifications.enableQuietHours")}
              isSelected={quietEnabled}
              onChange={setQuietEnabled}
            />
            <p className="text-sm text-muted-foreground">
              {t("notifications.quietHoursHint")}
            </p>
            {quietEnabled ? (
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-start">
                    {t("notifications.quietStart")}
                  </Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={quietStart}
                    onChange={(event) => setQuietStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-end">
                    {t("notifications.quietEnd")}
                  </Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={quietEnd}
                    onChange={(event) => setQuietEnd(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("notifications.footerHint")}
          </SettingsFieldsetStatus>
          <SettingsFieldsetActions>
            <Button
              size="sm"
              isDisabled={notifyPending}
              onPress={saveNotifications}
            >
              {notifyPending ? t("profile.saving") : t("profile.save")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>
    </div>
  )
}
