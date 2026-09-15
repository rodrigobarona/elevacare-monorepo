"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { useTranslations } from "next-intl"
import { saveInvoicingChoice, startToconlineOAuth } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

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
    slug: "moloni" as const,
    installType: "oauth",
    countries: ["PT"],
    disabled: true,
  },
  {
    slug: "manual" as const,
    installType: "manual",
    countries: ["PT", "ES", "BR"],
  },
]

interface Props {
  profile: OnboardingProfile
  onDone: () => void
  workspaceBase: string
  invoicingError?: string
  toconlineEnabled: boolean
}

export function StepInvoicing({
  profile,
  onDone,
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

  const alreadyConnected =
    profile.invoicingSetupStatus === "connected" ||
    profile.invoicingSetupStatus === "manual_acknowledged"

  async function handleSelect(slug: "toconline" | "moloni" | "manual") {
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
        onDone()
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

  if (alreadyConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-green-500 text-green-700">
            {profile.invoicingProvider === "manual"
              ? t("acknowledged")
              : t("connected")}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {t("connectedVia", {
              provider: profile.invoicingProvider ?? "",
            })}
          </span>
        </div>
        <Button size="sm" onPress={onDone}>
          {t("continue")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {displayError ? (
        <Alert variant="destructive">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <div className="grid gap-3">
        {ADAPTERS.map((adapter) => {
          const isDisabled =
            pending ||
            adapter.disabled ||
            (adapter.slug === "toconline" && !toconlineEnabled)
          return (
            <Card
              key={adapter.slug}
              className={
                isDisabled && adapter.slug !== "manual" ? "opacity-50" : ""
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {t(`adapters.${adapter.slug}.name`)}
                  </CardTitle>
                  <Badge variant="secondary">
                    {adapter.countries.join(", ")}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {t(`adapters.${adapter.slug}.description`)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {adapter.slug === "manual" ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("manualLegal")}
                    </p>
                    <CheckboxField
                      isSelected={manualAcknowledged}
                      onChange={setManualAcknowledged}
                      isDisabled={pending}
                      label={t("manualCheckbox")}
                    />
                  </>
                ) : null}
                <Button
                  size="sm"
                  variant={adapter.slug === "manual" ? "outline" : "default"}
                  isDisabled={
                    isDisabled ||
                    (adapter.slug === "manual" && !manualAcknowledged)
                  }
                  onPress={() => handleSelect(adapter.slug)}
                >
                  {adapter.slug === "manual"
                    ? t("acknowledgeManual")
                    : adapter.slug === "toconline"
                      ? t("connectToconline")
                      : t("connectProvider")}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
