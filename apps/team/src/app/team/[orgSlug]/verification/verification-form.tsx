"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { fileVerification, type FileVerificationError } from "./actions"

/** The same shape the API accepts once spaces, dots and dashes are gone. */
const TAX_ID = /^[A-Za-z0-9]{8,32}$/

type FieldError = "legal-name" | "invalid-tax-id"

export function VerificationForm({
  legalName: sentLegalName,
  taxId: sentTaxId,
  resend,
}: {
  /** What was sent before, when there is something to correct. */
  legalName: string
  taxId: string
  /** The clinic already sent details once. */
  resend: boolean
}) {
  const t = useTranslations("verification.form")
  const [legalName, setLegalName] = React.useState(sentLegalName)
  const [taxId, setTaxId] = React.useState(sentTaxId)
  const [fieldError, setFieldError] = React.useState<FieldError | null>(null)
  const [error, setError] = React.useState<FileVerificationError | null>(null)
  const [pending, startTransition] = React.useTransition()
  const nameId = React.useId()
  const taxIdId = React.useId()
  const nameErrorId = React.useId()
  const taxHelpId = React.useId()
  const taxErrorId = React.useId()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (legalName.trim().length < 2) {
      setFieldError("legal-name")
      return
    }
    if (!TAX_ID.test(taxId.replace(/[\s.-]/g, ""))) {
      setFieldError("invalid-tax-id")
      return
    }
    setFieldError(null)
    startTransition(async () => {
      const result = await fileVerification({
        legalName: legalName.trim(),
        taxId: taxId.trim(),
      })
      if (result.ok) {
        toast.success(t("sent"))
        return
      }
      if (result.error === "invalid-tax-id") setFieldError("invalid-tax-id")
      else setError(result.error)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={nameId}>{t("legalName")}</Label>
        <Input
          id={nameId}
          value={legalName}
          maxLength={200}
          autoComplete="organization"
          readOnly={pending}
          onChange={(e) => {
            setLegalName(e.target.value)
            if (fieldError === "legal-name") setFieldError(null)
          }}
          aria-invalid={fieldError === "legal-name" ? true : undefined}
          aria-describedby={
            fieldError === "legal-name" ? nameErrorId : undefined
          }
          data-testid="verification-legal-name"
        />
        {fieldError === "legal-name" ? (
          <p id={nameErrorId} role="alert" className="text-sm text-destructive">
            {t("errors.legal-name")}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={taxIdId}>{t("taxId")}</Label>
        <Input
          id={taxIdId}
          value={taxId}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          readOnly={pending}
          onChange={(e) => {
            setTaxId(e.target.value)
            if (fieldError === "invalid-tax-id") setFieldError(null)
          }}
          aria-invalid={fieldError === "invalid-tax-id" ? true : undefined}
          aria-describedby={
            fieldError === "invalid-tax-id"
              ? `${taxHelpId} ${taxErrorId}`
              : taxHelpId
          }
          data-testid="verification-tax-id"
        />
        <p id={taxHelpId} className="text-sm text-muted-foreground">
          {t("taxIdHelp")}
        </p>
        {fieldError === "invalid-tax-id" ? (
          <p
            id={taxErrorId}
            role="alert"
            className="text-sm text-destructive"
            data-testid="verification-tax-id-error"
          >
            {t("errors.invalid-tax-id")}
          </p>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-3">
        <Button
          type="submit"
          className="max-sm:h-10 max-sm:w-full"
          isDisabled={pending}
          data-testid="verification-send"
        >
          {pending ? t("sending") : resend ? t("sendAgain") : t("send")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("use")}</p>
      </div>
    </form>
  )
}
