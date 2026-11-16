"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { EU_SERVICE_COUNTRIES } from "@eleva/config"
import { Button } from "@eleva/ui/components/button"
import { Label } from "@eleva/ui/components/label"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@eleva/ui/components/accordion"
import { displayName, uniqueUpper, type PracticeValue } from "./practice-value"

/**
 * Where the expert practises, which countries they serve and the
 * languages they speak. Shared by the setup "practice" step and the
 * public-profile settings, so both read and save the same fields.
 */

/** Launch practice-country picker (Portugal-first markets). */
const PRACTICE_COUNTRY_OPTIONS = [
  { value: "PT", labelKey: "countries.PT" as const },
  { value: "ES", labelKey: "countries.ES" as const },
  { value: "BR", labelKey: "countries.BR" as const },
]

const LANGUAGE_OPTIONS = [
  { value: "pt", labelKey: "languageLabels.pt" as const },
  { value: "en", labelKey: "languageLabels.en" as const },
  { value: "es", labelKey: "languageLabels.es" as const },
]

/** More countries an expert can add, shown by name in their language. */
const EXTRA_COUNTRY_CODES = [
  ...EU_SERVICE_COUNTRIES,
  "GB",
  "CH",
  "NO",
  "IS",
  "LI",
  "AO",
  "MZ",
  "CV",
  "GW",
  "ST",
  "TL",
  "US",
  "CA",
]

/** More languages an expert can add, shown by name in their language. */
const EXTRA_LANGUAGE_CODES = [
  "fr",
  "de",
  "it",
  "nl",
  "ca",
  "gl",
  "eu",
  "ro",
  "pl",
  "uk",
  "ru",
  "ar",
  "zh",
  "hi",
  "sv",
  "da",
  "fi",
  "el",
  "cs",
  "hu",
  "bg",
  "hr",
  "tr",
]

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((v) => v !== item) : [...list, item]
}

export function PracticeFields({
  idPrefix,
  value,
  onChange,
  onRequiredMissing,
  countryNote,
}: {
  idPrefix: string
  value: PracticeValue
  onChange: (next: PracticeValue) => void
  /** Called when an action needs the practice country first. */
  onRequiredMissing?: () => void
  /**
   * Locks the practice country and explains why. After setup the country
   * follows the licence and changes only through support.
   */
  countryNote?: string
}) {
  const t = useTranslations("onboarding.practice")
  const locale = useLocale()
  const id = (field: string) => `${idPrefix}-${field}`
  // Countries chosen beyond the auto-included practice base: changing the
  // base drops the old base unless the expert picked it on purpose.
  const [explicit, setExplicit] = React.useState(
    () =>
      new Set(value.serviceCountries.filter((c) => c !== value.practiceCountry))
  )
  const regionNames = React.useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale]
  )
  const languageNames = React.useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  )
  const byName = (names: Intl.DisplayNames) => (a: string, b: string) =>
    displayName(names, a).localeCompare(displayName(names, b), locale)

  const { practiceCountry, serviceCountries, languages } = value
  const countryChoices = [...new Set(EXTRA_COUNTRY_CODES)]
    .filter(
      (code) =>
        !serviceCountries.includes(code) &&
        !PRACTICE_COUNTRY_OPTIONS.some((opt) => opt.value === code)
    )
    .sort(byName(regionNames))
  const languageChoices = EXTRA_LANGUAGE_CODES.filter(
    (code) => !languages.includes(code)
  ).sort(byName(languageNames))
  const beyondPractice =
    practiceCountry.length > 0 &&
    serviceCountries.some((c) => c !== practiceCountry)
  const customServiceCountries = serviceCountries.filter(
    (c) =>
      !PRACTICE_COUNTRY_OPTIONS.some((opt) => opt.value === c) &&
      c !== practiceCountry
  )

  function setPracticeCountry(code: string) {
    const withoutOldBase =
      practiceCountry && !explicit.has(practiceCountry)
        ? serviceCountries.filter((c) => c !== practiceCountry)
        : serviceCountries
    onChange({
      ...value,
      practiceCountry: code,
      serviceCountries: withoutOldBase.includes(code)
        ? withoutOldBase
        : [...withoutOldBase, code],
    })
  }

  function setServed(code: string, selected: boolean) {
    if (code === practiceCountry) return
    onChange({
      ...value,
      serviceCountries: selected
        ? serviceCountries.includes(code)
          ? serviceCountries
          : [...serviceCountries, code]
        : serviceCountries.filter((c) => c !== code),
    })
    setExplicit((prev) => {
      const next = new Set(prev)
      if (selected) next.add(code)
      else next.delete(code)
      return next
    })
  }

  function applyEuPreset() {
    if (!practiceCountry) {
      onRequiredMissing?.()
      return
    }
    onChange({
      ...value,
      serviceCountries: uniqueUpper([
        ...serviceCountries,
        ...EU_SERVICE_COUNTRIES,
        practiceCountry,
      ]),
    })
    setExplicit((prev) => {
      const next = new Set(prev)
      for (const c of EU_SERVICE_COUNTRIES) {
        if (c !== practiceCountry) next.add(c)
      }
      return next
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={id("country")}>{t("practiceCountry")}</Label>
        <Select
          selectedKey={practiceCountry || null}
          placeholder={t("practiceCountryPlaceholder")}
          aria-label={t("practiceCountry")}
          aria-describedby={countryNote ? id("country-note") : undefined}
          isDisabled={Boolean(countryNote)}
          onSelectionChange={(key) => {
            if (typeof key === "string") setPracticeCountry(key)
          }}
          className="w-full"
        >
          <SelectTrigger id={id("country")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRACTICE_COUNTRY_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                id={opt.value}
                textValue={t(opt.labelKey)}
              >
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {countryNote ? (
          <p id={id("country-note")} className="text-sm text-muted-foreground">
            {countryNote}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("serviceCountries")}</legend>
        <p className="text-sm text-muted-foreground">
          {t("serviceCountriesHelp")}
        </p>
        <div className="flex flex-wrap gap-3">
          {PRACTICE_COUNTRY_OPTIONS.map((opt) => (
            <CheckboxField
              key={opt.value}
              id={id(`service-${opt.value}`)}
              label={
                opt.value === practiceCountry
                  ? `${t(opt.labelKey)} ${t("alwaysIncluded")}`
                  : t(opt.labelKey)
              }
              isSelected={serviceCountries.includes(opt.value)}
              isDisabled={opt.value === practiceCountry}
              onChange={(selected) => setServed(opt.value, selected)}
            />
          ))}
        </div>
        {customServiceCountries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {customServiceCountries.map((code) => (
              <Button
                key={code}
                type="button"
                size="sm"
                variant="outline"
                aria-label={t("removeItem", {
                  name: displayName(regionNames, code),
                })}
                onPress={() => setServed(code, false)}
              >
                {displayName(regionNames, code)} ×
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor={id("extra-country")}>{t("addCountry")}</Label>
            <Select
              selectedKey={null}
              placeholder={t("addCountryPlaceholder")}
              onSelectionChange={(key) => {
                if (typeof key === "string") setServed(key, true)
              }}
              aria-label={t("addCountry")}
            >
              <SelectTrigger id={id("extra-country")} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countryChoices.map((code) => (
                  <SelectItem
                    key={code}
                    id={code}
                    textValue={displayName(regionNames, code)}
                  >
                    {displayName(regionNames, code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onPress={applyEuPreset}
          >
            {t("euPreset")}
          </Button>
        </div>
        {beyondPractice ? (
          <Alert>
            <AlertDescription>{t("legalHelper")}</AlertDescription>
          </Alert>
        ) : null}
        <Accordion>
          <AccordionItem id={id("why-we-ask")}>
            <AccordionTrigger>{t("whyWeAskTitle")}</AccordionTrigger>
            <AccordionContent>{t("whyWeAskBody")}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("languagesLabel")}</legend>
        <div className="flex flex-wrap gap-3">
          {LANGUAGE_OPTIONS.map((opt) => (
            <CheckboxField
              key={opt.value}
              id={id(`lang-${opt.value}`)}
              label={t(opt.labelKey)}
              isSelected={languages.includes(opt.value)}
              onChange={() =>
                onChange({
                  ...value,
                  languages: toggleItem(languages, opt.value),
                })
              }
            />
          ))}
        </div>
        {languages
          .filter((l) => !LANGUAGE_OPTIONS.some((opt) => opt.value === l))
          .map((code) => (
            <Button
              key={code}
              type="button"
              size="sm"
              variant="outline"
              aria-label={t("removeItem", {
                name: displayName(languageNames, code),
              })}
              onPress={() =>
                onChange({
                  ...value,
                  languages: languages.filter((l) => l !== code),
                })
              }
            >
              {displayName(languageNames, code)} ×
            </Button>
          ))}
        <div className="space-y-1.5 pt-2">
          <Label htmlFor={id("extra-language")}>{t("addLanguage")}</Label>
          <Select
            selectedKey={null}
            placeholder={t("addLanguagePlaceholder")}
            onSelectionChange={(key) => {
              if (typeof key === "string" && !languages.includes(key)) {
                onChange({ ...value, languages: [...languages, key] })
              }
            }}
            aria-label={t("addLanguage")}
          >
            <SelectTrigger id={id("extra-language")} className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languageChoices.map((code) => (
                <SelectItem
                  key={code}
                  id={code}
                  textValue={displayName(languageNames, code)}
                >
                  {displayName(languageNames, code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <CheckboxField
          id={id("worldwide")}
          label={t("worldwideRemote")}
          isSelected={value.worldwideRemote}
          onChange={(worldwideRemote) =>
            onChange({ ...value, worldwideRemote })
          }
        />
        <p className="text-sm text-muted-foreground">
          {t("worldwideRemoteHelp")}
        </p>
      </div>
    </div>
  )
}
