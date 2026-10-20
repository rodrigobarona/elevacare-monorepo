"use client"

import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { useTranslations } from "next-intl"
import { InvoicingProviderPicker } from "@/app/[orgSlug]/_components/invoicing-provider-picker"
import type { OnboardingProfile } from "./onboarding-wizard"

interface Props {
  profile: OnboardingProfile
  onDone: () => void
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
  const alreadyConnected =
    profile.invoicingSetupStatus === "connected" ||
    profile.invoicingSetupStatus === "manual_acknowledged"

  if (alreadyConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-success/40 bg-success-subtle text-success"
          >
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
    <InvoicingProviderPicker
      onSaved={onDone}
      invoicingError={invoicingError}
      toconlineEnabled={toconlineEnabled}
    />
  )
}
