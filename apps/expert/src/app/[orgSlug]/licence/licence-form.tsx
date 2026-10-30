"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import {
  LicenceFields,
  hasLicenceErrors,
  validateLicence,
  type LicenceErrors,
  type LicenceValue,
} from "../_components/licence-fields"
import { submitLicence, type SubmitLicenceError } from "./actions"

interface Props {
  initial: LicenceValue
  submitLabel: string
}

export function LicenceForm({ initial, submitLabel }: Props) {
  const t = useTranslations("licence.page")
  const router = useRouter()
  const [value, setValue] = React.useState(initial)
  const [errors, setErrors] = React.useState<LicenceErrors>({})
  const [error, setError] = React.useState<SubmitLicenceError | null>(null)
  const [pending, setPending] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors = validateLicence(value)
    setErrors(nextErrors)
    setError(null)
    if (hasLicenceErrors(nextErrors)) return

    setPending(true)
    const result = await submitLicence({
      professionalBody: value.professionalBody,
      licenceNumber: value.licenceNumber.trim(),
      ersRegistrationNumber: value.ersRegistrationNumber.trim(),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t("submitted"))
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <LicenceFields
        idPrefix="licence"
        value={value}
        errors={errors}
        onChange={(next) => {
          setValue(next)
          if (hasLicenceErrors(errors)) setErrors(validateLicence(next))
        }}
      />
      <Button type="submit" isPending={pending}>
        {pending ? t("submitting") : submitLabel}
      </Button>
    </form>
  )
}
