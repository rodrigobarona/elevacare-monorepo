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
  /** Replaces the fields' default intro. */
  intro?: string
  /** Hide the "why we ask" note (the expert already sent these once). */
  showWhy?: boolean
  /**
   * A correction to an open review: sending the same details again would
   * restart the check for nothing, so ask for a change first.
   */
  requireChange?: boolean
  /** Toast after a successful send; defaults to `submitted`. */
  successMessage?: string
  /** Shown as a quiet secondary action next to submit. */
  onCancel?: () => void
  /** Called with the details that were sent. */
  onSubmitted?: (sent: LicenceValue) => void
}

type FormError = SubmitLicenceError | "unchanged"

function normalise(value: LicenceValue): LicenceValue {
  return {
    professionalBody: value.professionalBody,
    licenceNumber: value.licenceNumber.trim(),
    ersRegistrationNumber: value.ersRegistrationNumber.trim(),
  }
}

export function LicenceForm({
  initial,
  submitLabel,
  intro,
  showWhy,
  requireChange = false,
  successMessage,
  onCancel,
  onSubmitted,
}: Props) {
  const t = useTranslations("licence.page")
  const router = useRouter()
  const [value, setValue] = React.useState(initial)
  const [errors, setErrors] = React.useState<LicenceErrors>({})
  const [error, setError] = React.useState<FormError | null>(null)
  const [pending, setPending] = React.useState(false)
  const errorRef = React.useRef<HTMLDivElement>(null)

  // A message mounted with its text is not announced by every screen
  // reader; moving focus to it is.
  React.useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors = validateLicence(value)
    setErrors(nextErrors)
    setError(null)
    if (hasLicenceErrors(nextErrors)) return

    const next = normalise(value)
    const before = normalise(initial)
    if (
      requireChange &&
      next.professionalBody === before.professionalBody &&
      next.licenceNumber === before.licenceNumber &&
      next.ersRegistrationNumber === before.ersRegistrationNumber
    ) {
      setError("unchanged")
      return
    }

    setPending(true)
    const result = await submitLicence(next)
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(successMessage ?? t("submitted"))
    onSubmitted?.(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert variant={error === "unchanged" ? "default" : "destructive"}>
            <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <LicenceFields
        idPrefix="licence"
        intro={intro}
        showWhy={showWhy}
        isDisabled={pending}
        value={value}
        errors={errors}
        onChange={(next) => {
          setValue(next)
          if (error === "unchanged") setError(null)
          if (hasLicenceErrors(errors)) setErrors(validateLicence(next))
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" isPending={pending}>
          {pending ? t("submitting") : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onPress={onCancel} isDisabled={pending}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
