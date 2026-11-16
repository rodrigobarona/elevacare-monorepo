"use client"

import { useMemo, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { PracticeFields } from "../_components/practice-fields"
import {
  displayName,
  isPracticeComplete,
  practicePayload,
  removedFromPractice,
  samePractice,
  type PracticeValue,
} from "../_components/practice-value"
import { BlockedByServices, plainList, quotedList } from "./blocked-by-services"
import { savePracticeDetails } from "./actions"

/** Where the expert practises, the countries they serve and their languages. */
export function PracticeSection({
  initial,
  servicesHref,
}: {
  initial: PracticeValue
  servicesHref: string
}) {
  const t = useTranslations("publicProfile")
  const locale = useLocale()
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [isSaving, startSaving] = useTransition()
  // Set when the API refuses the change because published services rely
  // on what it removes; the expert has to change those services first.
  const [blocked, setBlocked] = useState<string | null>(null)
  const regionNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale]
  )
  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  )

  const isDirty = !samePractice(value, saved)
  const isComplete = isPracticeComplete(value)

  function blockedMessage(services: string[], next: PracticeValue): string {
    if (services.length === 0) return t("practice.errors.offer-invariant")
    const removed = removedFromPractice(saved, next)
    const names = [
      ...removed.languages.map((code) => displayName(languageNames, code)),
      ...removed.countries.map((code) => displayName(regionNames, code)),
    ]
    const values = {
      count: services.length,
      services: quotedList(locale, services),
    }
    return names.length > 0
      ? t("practice.errors.offer-invariant-removed", {
          ...values,
          removed: plainList(locale, names),
        })
      : t("practice.errors.offer-invariant-named", values)
  }

  function save() {
    const next = practicePayload(value)
    startSaving(async () => {
      const result = await savePracticeDetails(next)
      if (!result.ok) {
        if (result.error === "offer-invariant") {
          setBlocked(blockedMessage(result.services ?? [], next))
          return
        }
        toast.error(
          result.error === "validation" || result.error === "country-locked"
            ? t(
                result.error === "validation"
                  ? "practice.errors.validation"
                  : "practice.countryLocked"
              )
            : t("saveFailed")
        )
        return
      }
      setBlocked(null)
      toast.success(t("saved"))
      // Only the baseline moves: anything typed while saving stays in the
      // form and keeps it marked as changed.
      setSaved(next)
    })
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("practice.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("practice.description")}
        </SettingsFieldsetDescription>
        <div className="mt-4">
          <PracticeFields
            idPrefix="profile-practice"
            value={value}
            onChange={(next) => {
              setValue(next)
              setBlocked(null)
            }}
            countryNote={t("practice.countryLocked")}
            onRequiredMissing={() => toast.error(t("practice.errors.required"))}
          />
        </div>
        {blocked ? (
          <BlockedByServices message={blocked} servicesHref={servicesHref} />
        ) : null}
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        {isDirty && !isComplete ? (
          <p className="text-sm text-muted-foreground">
            {t("practice.errors.required")}
          </p>
        ) : null}
        <SettingsFieldsetActions>
          <Button
            type="button"
            size="sm"
            isDisabled={!isDirty || !isComplete || isSaving}
            onPress={save}
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
