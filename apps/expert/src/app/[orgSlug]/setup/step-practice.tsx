"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
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
import { savePracticeStep } from "./actions"

/** Launch practice-country picker (Portugal-first markets). */
const PRACTICE_COUNTRY_OPTIONS = [
  { value: "PT", labelKey: "countries.PT" as const },
  { value: "ES", labelKey: "countries.ES" as const },
  { value: "BR", labelKey: "countries.BR" as const },
]

/** EU ISO list for the service-countries preset (D-02 phone/EU reference). */
const EU_SERVICE_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const

const LANGUAGE_OPTIONS = [
  { value: "pt", labelKey: "languageLabels.pt" as const },
  { value: "en", labelKey: "languageLabels.en" as const },
  { value: "es", labelKey: "languageLabels.es" as const },
]

const ISO_COUNTRY = /^[A-Za-z]{2}$/
const BCP47_LANG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export interface PracticeStepProfile {
  practiceCountry: string
  serviceCountries: string[]
  languages: string[]
  licenseScope: string | null
  worldwideRemote: boolean
}

interface Props {
  profile: PracticeStepProfile
  onDone: () => void
}

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((v) => v !== item) : [...list, item]
}

function uniqueUpper(codes: string[]): string[] {
  return [...new Set(codes.map((c) => c.toUpperCase()))]
}

export function StepPractice({ profile, onDone }: Props) {
  const t = useTranslations("onboarding.practice")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Always hydrate from persisted profile so a failed completeStep after a
  // successful PATCH does not wipe the form. Schema defaults still need an
  // explicit Save (API sets metadata.practiceDeclaredAt).
  const [practiceCountry, setPracticeCountry] = React.useState(
    profile.practiceCountry || ""
  )
  const [serviceCountries, setServiceCountries] = React.useState<string[]>(
    uniqueUpper(
      profile.serviceCountries.length > 0
        ? profile.serviceCountries
        : profile.practiceCountry
          ? [profile.practiceCountry]
          : []
    )
  )
  const [languages, setLanguages] = React.useState<string[]>(profile.languages)
  const [licenseScope, setLicenseScope] = React.useState(
    profile.licenseScope ?? ""
  )
  const [worldwideRemote, setWorldwideRemote] = React.useState(
    profile.worldwideRemote
  )
  const [extraCountry, setExtraCountry] = React.useState("")
  const [extraLanguage, setExtraLanguage] = React.useState("")

  const beyondPractice =
    practiceCountry.length > 0 &&
    serviceCountries.some((c) => c !== practiceCountry)

  function setPracticeCountryAndSync(code: string) {
    // Keep prior service countries; only ensure the new practice base is included.
    setPracticeCountry(code)
    setServiceCountries((prev) =>
      prev.includes(code) ? prev : [...prev, code]
    )
  }

  function addExtraCountry() {
    const code = extraCountry.trim().toUpperCase()
    if (!ISO_COUNTRY.test(code)) {
      setError(t("errors.invalidCountry"))
      return
    }
    setServiceCountries((prev) =>
      prev.includes(code) ? prev : [...prev, code]
    )
    setExtraCountry("")
    setError(null)
  }

  function addExtraLanguage() {
    const code = extraLanguage.trim().toLowerCase()
    if (!BCP47_LANG.test(code)) {
      setError(t("errors.invalidLanguage"))
      return
    }
    setLanguages((prev) => (prev.includes(code) ? prev : [...prev, code]))
    setExtraLanguage("")
    setError(null)
  }

  function applyEuPreset() {
    if (!practiceCountry) {
      setError(t("errors.required"))
      return
    }
    setServiceCountries((prev) =>
      uniqueUpper([...prev, ...EU_SERVICE_COUNTRIES, practiceCountry])
    )
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    if (!practiceCountry || languages.length < 1) {
      setError(t("errors.required"))
      setPending(false)
      return
    }

    const countries = uniqueUpper(
      serviceCountries.includes(practiceCountry)
        ? serviceCountries
        : [...serviceCountries, practiceCountry]
    )

    try {
      const result = await savePracticeStep({
        practiceCountry,
        serviceCountries: countries,
        languages,
        licenseScope: licenseScope.trim() || null,
        worldwideRemote,
      })

      if (result.ok) {
        onDone()
      } else {
        setError(t(`errors.${result.error}` as "errors.save-failed"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save-failed"))
    } finally {
      setPending(false)
    }
  }

  const customServiceCountries = serviceCountries.filter(
    (c) =>
      !PRACTICE_COUNTRY_OPTIONS.some((opt) => opt.value === c) &&
      c !== practiceCountry
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <div className="space-y-1.5">
        <Label htmlFor="practice-country">{t("practiceCountry")}</Label>
        <Select
          selectedKey={practiceCountry || null}
          placeholder={t("practiceCountryPlaceholder")}
          onSelectionChange={(key) => {
            if (typeof key === "string") setPracticeCountryAndSync(key)
          }}
          className="w-full"
        >
          <SelectTrigger id="practice-country" className="w-full">
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
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("serviceCountries")}</legend>
        <p className="text-xs text-muted-foreground">
          {t("serviceCountriesHelp")}
        </p>
        <div className="flex flex-wrap gap-3">
          {PRACTICE_COUNTRY_OPTIONS.map((opt) => (
            <CheckboxField
              key={opt.value}
              id={`practice-service-${opt.value}`}
              label={t(opt.labelKey)}
              isSelected={serviceCountries.includes(opt.value)}
              isDisabled={opt.value === practiceCountry}
              onChange={() => {
                if (opt.value === practiceCountry) return
                setServiceCountries(toggleItem(serviceCountries, opt.value))
              }}
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
                onPress={() =>
                  setServiceCountries((prev) => prev.filter((c) => c !== code))
                }
              >
                {code} ×
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="extra-country">{t("addCountry")}</Label>
            <Input
              id="extra-country"
              value={extraCountry}
              onChange={(e) => setExtraCountry(e.target.value)}
              placeholder="FR"
              maxLength={2}
              className="w-24 uppercase"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onPress={addExtraCountry}
          >
            {t("add")}
          </Button>
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
          <AccordionItem id="why-we-ask">
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
              id={`practice-lang-${opt.value}`}
              label={t(opt.labelKey)}
              isSelected={languages.includes(opt.value)}
              onChange={() => setLanguages(toggleItem(languages, opt.value))}
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
              onPress={() =>
                setLanguages((prev) => prev.filter((l) => l !== code))
              }
            >
              {code} ×
            </Button>
          ))}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="extra-language">{t("addLanguage")}</Label>
            <Input
              id="extra-language"
              value={extraLanguage}
              onChange={(e) => setExtraLanguage(e.target.value)}
              placeholder="fr"
              className="w-28"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onPress={addExtraLanguage}
          >
            {t("add")}
          </Button>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="license-scope">{t("licenseScope")}</Label>
        <Input
          id="license-scope"
          value={licenseScope}
          onChange={(e) => setLicenseScope(e.target.value)}
          placeholder={t("licenseScopePlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("licenseScopeHelp")}</p>
      </div>

      <div className="space-y-1.5">
        <CheckboxField
          id="practice-worldwide"
          label={t("worldwideRemote")}
          isSelected={worldwideRemote}
          onChange={setWorldwideRemote}
        />
        <p className="text-xs text-muted-foreground">
          {t("worldwideRemoteHelp")}
        </p>
      </div>

      <Button type="submit" isDisabled={pending}>
        {pending ? t("saving") : t("continue")}
      </Button>
    </form>
  )
}
