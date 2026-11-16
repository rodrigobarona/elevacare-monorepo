"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { isIanaTimeZone } from "@eleva/api-client"
import { isLocale, locales, localeNames, type Locale } from "@eleva/config/i18n"
import { Button } from "@eleva/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@eleva/ui/components/field"
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
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { updateRegion } from "./actions"

interface TimeZoneOption {
  id: string
  label: string
}

/** "GMT+1" for a zone right now, or "" when the runtime cannot say. */
function offsetOf(zone: string, uiLocale: string): string {
  try {
    return (
      new Intl.DateTimeFormat(uiLocale, {
        timeZone: zone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? ""
    )
  } catch {
    return ""
  }
}

/** "Europe/Lisbon" → "Lisbon, Europe (GMT+0)", sorted by name. */
function timeZoneOptions(current: string, uiLocale: string): TimeZoneOption[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC", "Europe/Lisbon", "Europe/Madrid", "America/Sao_Paulo"]
  const all = Array.from(new Set([current, ...zones])).filter(isIanaTimeZone)
  return all
    .map((id) => {
      const parts = id.split("/")
      const city = (parts.at(-1) ?? id).replaceAll("_", " ")
      const place = parts.length > 1 ? `${city}, ${parts[0]}` : city
      const offset = offsetOf(id, uiLocale)
      return { id, label: offset ? `${place} (${offset})` : place }
    })
    .sort((a, b) => a.label.localeCompare(b.label, uiLocale))
}

interface RegionCardProps {
  locale: Locale
  timezone: string
}

/** Language (interface and emails) and the time zone sessions are shown in. */
export function RegionCard({
  locale: initialLocale,
  timezone: initialTimezone,
}: RegionCardProps) {
  const t = useTranslations("profile.region")
  const uiLocale = useLocale()
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [saving, setSaving] = useState(false)
  const zones = useMemo(
    () => timeZoneOptions(initialTimezone, uiLocale),
    [initialTimezone, uiLocale]
  )
  const changed = locale !== initialLocale || timezone !== initialTimezone

  async function onSave() {
    setSaving(true)
    try {
      const { ok } = await updateRegion({ locale, timezone })
      if (!ok) {
        toast.error(t("error"))
        return
      }
      toast.success(t("saved"))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsFieldset data-testid="profile-region">
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <FieldGroup className="mt-6 gap-6">
          <Field>
            <FieldLabel id="profile-language-label">{t("language")}</FieldLabel>
            <Select
              aria-labelledby="profile-language-label"
              aria-describedby="profile-language-hint"
              selectedKey={locale}
              onSelectionChange={(key) => {
                if (typeof key === "string" && isLocale(key)) setLocale(key)
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
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
            <FieldDescription id="profile-language-hint">
              {t("languageHint")}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel id="profile-timezone-label">{t("timezone")}</FieldLabel>
            <Select
              aria-labelledby="profile-timezone-label"
              aria-describedby="profile-timezone-hint"
              selectedKey={timezone}
              onSelectionChange={(key) => {
                if (typeof key === "string" && isIanaTimeZone(key)) {
                  setTimezone(key)
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} id={zone.id} textValue={zone.label}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription id="profile-timezone-hint">
              {t("timezoneHint")}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter className="sm:justify-end">
        <SettingsFieldsetActions>
          <Button
            size="sm"
            isDisabled={saving || !changed}
            onPress={() => void onSave()}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
