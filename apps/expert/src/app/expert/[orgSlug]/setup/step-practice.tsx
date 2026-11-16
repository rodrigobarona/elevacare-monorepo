"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { savePracticeStep } from "./actions"
import {
  LicenceFields,
  hasLicenceErrors,
  validateLicence,
  type LicenceErrors,
  type LicenceValue,
} from "../_components/licence-fields"
import { PracticeFields } from "../_components/practice-fields"
import {
  initialPracticeValue,
  isPracticeComplete,
  practicePayload,
  type PracticeValue,
} from "../_components/practice-value"

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

const KNOWN_ERRORS = new Set([
  "required",
  "validation",
  "save-failed",
  "offer-invariant",
  "practice-incomplete",
  "licence-locked",
])

export function StepPractice({ profile, onDone }: Props) {
  const t = useTranslations("onboarding.practice")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Always hydrate from persisted profile so a failed completeStep after a
  // successful PATCH does not wipe the form. Schema defaults still need an
  // explicit Save (API sets metadata.practiceDeclaredAt).
  const [practice, setPractice] = React.useState<PracticeValue>(() =>
    initialPracticeValue(profile)
  )
  const [licence, setLicence] = React.useState<LicenceValue>({
    professionalBody: profile.professionalBody ?? "",
    licenceNumber: profile.licenceNumber ?? "",
    ersRegistrationNumber: profile.ersRegistrationNumber ?? "",
  })
  const [licenceErrors, setLicenceErrors] = React.useState<LicenceErrors>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    if (!isPracticeComplete(practice)) {
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

    try {
      const result = await savePracticeStep({
        ...practicePayload(practice),
        professionalBody: licence.professionalBody,
        licenceNumber: licence.licenceNumber.trim(),
        ersRegistrationNumber: licence.ersRegistrationNumber.trim(),
      })

      if (result.ok) {
        onDone()
      } else {
        const key = KNOWN_ERRORS.has(result.error)
          ? result.error
          : "save-failed"
        setError(t(`errors.${key}` as "errors.save-failed"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save-failed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <PracticeFields
        idPrefix="practice"
        value={practice}
        onChange={(next) => {
          setPractice(next)
          setError(null)
        }}
        onRequiredMissing={() => setError(t("errors.required"))}
      />

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

      <Button type="submit" isDisabled={pending}>
        {pending ? t("saving") : t("continue")}
      </Button>
    </form>
  )
}
