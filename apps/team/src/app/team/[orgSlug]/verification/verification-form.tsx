"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { normalizeClinicTaxId } from "@eleva/config/clinic-verification"
import { fileVerification, type FileVerificationError } from "./actions"

type FieldError = "legal-name" | "invalid-tax-id"

export function VerificationForm({
  sent,
  prefill,
  waitForChange,
  intent,
  primary,
  focusAfterSendId,
}: {
  /** The details Eleva already holds, if any were sent. */
  sent: { legalName: string; taxId: string } | null
  /** Start from what was sent, ready to correct. */
  prefill: boolean
  /**
   * Staff are checking these details right now: sending them again
   * unchanged would only move the clinic to the back of the queue.
   */
  waitForChange: boolean
  /** First details, a correction of what was sent, or new details. */
  intent: "first" | "correction" | "new"
  /** Sending details is the next step on the page. */
  primary: boolean
  /** Where focus goes once the details are sent. */
  focusAfterSendId: string
}) {
  const t = useTranslations("verification.form")
  const [legalName, setLegalName] = React.useState(
    prefill ? (sent?.legalName ?? "") : ""
  )
  const [taxId, setTaxId] = React.useState(prefill ? (sent?.taxId ?? "") : "")
  const nameRef = React.useRef<HTMLInputElement>(null)
  const taxIdRef = React.useRef<HTMLInputElement>(null)
  const unchangedId = React.useId()
  // Only while a check is running. After staff asked for a change or
  // refused, the same details can be sent again: what they asked for may be
  // somewhere else (the billing address, a register updated since).
  const unchanged =
    waitForChange &&
    sent !== null &&
    legalName.trim() === sent.legalName &&
    normalizeClinicTaxId(taxId) === sent.taxId
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
      nameRef.current?.focus()
      return
    }
    if (normalizeClinicTaxId(taxId) === null) {
      setFieldError("invalid-tax-id")
      taxIdRef.current?.focus()
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
        // The form is replaced by the new standing: focus goes to it, not
        // back to the top of the page.
        document.getElementById(focusAfterSendId)?.focus()
        return
      }
      if (result.error === "invalid-tax-id") {
        setFieldError("invalid-tax-id")
        taxIdRef.current?.focus()
      } else setError(result.error)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={nameId}>{t("legalName")}</Label>
        <Input
          id={nameId}
          ref={nameRef}
          aria-required
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
          ref={taxIdRef}
          aria-required
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
        {/* Before the button, so it is read before the button it explains. */}
        {unchanged ? (
          <p
            id={unchangedId}
            className="text-sm text-muted-foreground"
            data-testid="verification-unchanged"
          >
            {t("unchanged")}
          </p>
        ) : null}
        <Button
          type="submit"
          variant={primary ? "default" : "outline"}
          className="max-sm:h-10 max-sm:w-full"
          isDisabled={pending || unchanged}
          aria-describedby={unchanged ? unchangedId : undefined}
          data-testid="verification-send"
        >
          {pending
            ? t("sending")
            : intent === "first"
              ? t("send")
              : intent === "new"
                ? t("sendNew")
                : t("sendCorrection")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("use")}</p>
      </div>
    </form>
  )
}
