"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { useLocale, useTranslations } from "next-intl"
import {
  saveInvoicingChoice,
  startToconlineOAuth,
} from "@/app/expert/[orgSlug]/setup/actions"

const INVOICING_ERROR_CODES = [
  "flag_disabled",
  "not_found",
  "connect_failed",
  "provider_denied",
  "missing_params",
  "invalid_state",
  "invalid_provider",
] as const

type InvoicingErrorCode = (typeof INVOICING_ERROR_CODES)[number]

function isInvoicingErrorCode(value: string): value is InvoicingErrorCode {
  return (INVOICING_ERROR_CODES as readonly string[]).includes(value)
}

const ADAPTERS = [
  {
    slug: "toconline" as const,
    installType: "oauth",
    countries: ["PT"],
  },
  {
    slug: "manual" as const,
    installType: "manual",
    countries: ["PT", "ES", "BR"],
  },
]

interface Props {
  onSaved: () => void
  invoicingError?: string
  toconlineEnabled: boolean
}

export function InvoicingProviderPicker({
  onSaved,
  invoicingError,
  toconlineEnabled,
}: Props) {
  const t = useTranslations("onboarding.invoicing")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [manualAcknowledged, setManualAcknowledged] = React.useState(false)
  const callbackError =
    invoicingError && isInvoicingErrorCode(invoicingError)
      ? t(`errors.${invoicingError}`)
      : invoicingError
        ? t("errors.connect_failed")
        : null
  const displayError = error ?? callbackError
  const locale = useLocale()
  const countryNames = React.useMemo(
    () => new Intl.DisplayNames(locale, { type: "region" }),
    [locale]
  )
  const adapters = ADAPTERS.filter(
    (adapter) => adapter.slug !== "toconline" || toconlineEnabled
  )

  async function handleSelect(slug: "toconline" | "manual") {
    if (slug === "manual" && !manualAcknowledged) {
      setError(t("errors.manual_ack_required"))
      return
    }

    setPending(true)
    setError(null)

    try {
      if (slug === "toconline") {
        const result = await startToconlineOAuth()
        if (result.ok) {
          window.location.assign(result.url)
          return
        }
        setError(
          isInvoicingErrorCode(result.error)
            ? t(`errors.${result.error}`)
            : t("errors.connect_failed")
        )
        return
      }

      const result = await saveInvoicingChoice(
        slug,
        slug === "manual" ? manualAcknowledged : undefined
      )
      if (result.ok) {
        onSaved()
      } else {
        setError(result.error)
      }
    } catch (err) {
      console.error("[onboarding] invoicing select failed", err)
      setError(t("errors.connect_failed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {displayError ? (
        <Alert variant="destructive">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Only the ways that work today are offered; with one, there is
          nothing to choose between. */}
      {adapters.length > 1 ? (
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      ) : null}

      <div className="grid gap-3">
        {adapters.map((adapter) => {
          const manual = adapter.slug === "manual"
          return (
            <div
              key={adapter.slug}
              className="space-y-3 rounded-3xl border bg-card p-6 text-card-foreground shadow-1"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">
                  {t(`adapters.${adapter.slug}.name`)}
                </h3>
                {manual ? null : (
                  <Badge variant="secondary">
                    {adapter.countries
                      .map((code) => countryNames.of(code) ?? code)
                      .join(", ")}
                  </Badge>
                )}
              </div>
              {manual ? (
                <>
                  {/* The obligation she accepts: read before the box. */}
                  <p className="text-sm text-pretty">{t("manualLegal")}</p>
                  <CheckboxField
                    isSelected={manualAcknowledged}
                    onChange={setManualAcknowledged}
                    isDisabled={pending}
                    label={t("manualCheckbox")}
                  />
                </>
              ) : (
                <p className="text-sm text-pretty text-muted-foreground">
                  {t(`adapters.${adapter.slug}.description`)}
                </p>
              )}
              <Button
                size="sm"
                // The page's one solid action: linking an account when
                // that is offered, otherwise confirming her own invoicing.
                variant={manual && adapters.length > 1 ? "outline" : "default"}
                isDisabled={pending || (manual && !manualAcknowledged)}
                onPress={() => handleSelect(adapter.slug)}
              >
                {manual ? t("acknowledgeManual") : t("connectToconline")}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
