"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
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
import { savePracticeStep } from "./actions"
import {
  LicenceFields,
  hasLicenceErrors,
  validateLicence,
  type LicenceErrors,
  type LicenceValue,
} from "../_components/licence-fields"
import { EU_SERVICE_COUNTRIES } from "@eleva/config"

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

function displayName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

export interface PracticeStepProfile {
  practiceCountry: string
  serviceCountries: string[]
  languages: string[]
  professionalBody: string | null
  licenceNumber: string | null
  ersRegistrationNumber: string | null
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
  // Countries the expert chose beyond the auto-included practice base.
  const [explicitServiceCountries, setExplicitServiceCountries] =
    React.useState(() => {
      const base = (profile.practiceCountry || "").toUpperCase()
      const all = uniqueUpper(
        profile.serviceCountries.length > 0
          ? profile.serviceCountries
          : base
            ? [base]
            : []
      )
      return new Set(all.filter((c) => c !== base))
    })
  const [languages, setLanguages] = React.useState<string[]>(profile.languages)
  const [licence, setLicence] = React.useState<LicenceValue>({
    professionalBody: profile.professionalBody ?? "",
    licenceNumber: profile.licenceNumber ?? "",
    ersRegistrationNumber: profile.ersRegistrationNumber ?? "",
  })
  const [licenceErrors, setLicenceErrors] = React.useState<LicenceErrors>({})
  const [worldwideRemote, setWorldwideRemote] = React.useState(
    profile.worldwideRemote
  )
  const locale = useLocale()
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

  function setPracticeCountryAndSync(code: string) {
    setPracticeCountry((prevBase) => {
      setServiceCountries((prev) => {
        const withoutImplicitPrev =
          prevBase && !explicitServiceCountries.has(prevBase)
            ? prev.filter((c) => c !== prevBase)
            : prev
        return withoutImplicitPrev.includes(code)
          ? withoutImplicitPrev
          : [...withoutImplicitPrev, code]
      })
      return code
    })
  }

  function toggleServiceCountry(code: string, selected: boolean) {
    if (code === practiceCountry) return
    setServiceCountries((prev) =>
      selected
        ? prev.includes(code)
          ? prev
          : [...prev, code]
        : prev.filter((c) => c !== code)
    )
    setExplicitServiceCountries((prev) => {
      const next = new Set(prev)
      if (selected) next.add(code)
      else next.delete(code)
      return next
    })
  }

  function addExtraCountry(code: string) {
    setServiceCountries((prev) =>
      prev.includes(code) ? prev : [...prev, code]
    )
    setExplicitServiceCountries((prev) => new Set(prev).add(code))
    setError(null)
  }

  function addExtraLanguage(code: string) {
    setLanguages((prev) => (prev.includes(code) ? prev : [...prev, code]))
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
    setExplicitServiceCountries((prev) => {
      const next = new Set(prev)
      for (const c of EU_SERVICE_COUNTRIES) {
        if (c !== practiceCountry) next.add(c)
      }
      return next
    })
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

    const nextLicenceErrors = validateLicence(licence)
    setLicenceErrors(nextLicenceErrors)
    if (hasLicenceErrors(nextLicenceErrors)) {
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
        professionalBody: licence.professionalBody,
        licenceNumber: licence.licenceNumber.trim(),
        ersRegistrationNumber: licence.ersRegistrationNumber.trim(),
        worldwideRemote,
      })

      if (result.ok) {
        onDone()
      } else {
        const known = new Set([
          "required",
          "validation",
          "save-failed",
          "offer-invariant",
          "practice-incomplete",
          "licence-locked",
        ])
        const key = known.has(result.error) ? result.error : "save-failed"
        setError(t(`errors.${key}` as "errors.save-failed"))
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
              onChange={(selected) => {
                toggleServiceCountry(opt.value, selected)
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
                aria-label={t("removeItem", {
                  name: displayName(regionNames, code),
                })}
                onPress={() => {
                  setServiceCountries((prev) => prev.filter((c) => c !== code))
                  setExplicitServiceCountries((prev) => {
                    const next = new Set(prev)
                    next.delete(code)
                    return next
                  })
                }}
              >
                {displayName(regionNames, code)} ×
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="extra-country">{t("addCountry")}</Label>
            <Select
              selectedKey={null}
              placeholder={t("addCountryPlaceholder")}
              onSelectionChange={(key) => {
                if (typeof key === "string") addExtraCountry(key)
              }}
              aria-label={t("addCountry")}
            >
              <SelectTrigger id="extra-country" className="w-56">
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
              aria-label={t("removeItem", {
                name: displayName(languageNames, code),
              })}
              onPress={() =>
                setLanguages((prev) => prev.filter((l) => l !== code))
              }
            >
              {displayName(languageNames, code)} ×
            </Button>
          ))}
        <div className="space-y-1.5">
          <Label htmlFor="extra-language">{t("addLanguage")}</Label>
          <Select
            selectedKey={null}
            placeholder={t("addLanguagePlaceholder")}
            onSelectionChange={(key) => {
              if (typeof key === "string") addExtraLanguage(key)
            }}
            aria-label={t("addLanguage")}
          >
            <SelectTrigger id="extra-language" className="w-56">
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

      <LicenceFields
        idPrefix="practice-licence"
        value={licence}
        errors={licenceErrors}
        onChange={(next) => {
          setLicence(next)
          if (hasLicenceErrors(licenceErrors)) {
            setLicenceErrors(validateLicence(next))
          }
        }}
      />

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
