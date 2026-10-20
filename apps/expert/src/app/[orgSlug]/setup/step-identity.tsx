"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { verifyElevaIdentity } from "@eleva/billing/embedded"
import { SealCheckIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { createApiClient } from "@eleva/api-client"
import { markStepComplete } from "./actions"
import { setupErrorMessage } from "./setup-errors"
import type { OnboardingProfile } from "./onboarding-wizard"

interface Props {
  profile: OnboardingProfile
  apiBaseUrl: string
  stripePublishableKey: string
  onDone: () => void
}

export function StepIdentity({
  profile,
  apiBaseUrl,
  stripePublishableKey,
  onDone,
}: Props) {
  const t = useTranslations("onboarding")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function complete() {
    const result = await markStepComplete("identity")
    if (result.ok) onDone()
    else setError(setupErrorMessage(t, result.error))
  }

  async function run(task: () => Promise<void>) {
    setLoading(true)
    setError(null)
    try {
      await task()
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : setupErrorMessage(t, "save-failed")
      )
    } finally {
      setLoading(false)
    }
  }

  async function startVerification() {
    const api = createApiClient({ baseUrl: apiBaseUrl })
    const { clientSecret } = await api.stripe.identity.createSession()
    const result = await verifyElevaIdentity({
      publishableKey: stripePublishableKey,
      clientSecret,
    })
    if (!result.ok) {
      setError(result.message ?? setupErrorMessage(t, "save-failed"))
      return
    }
    await complete()
  }

  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null

  if (profile.stripeIdentityStatus === "verified") {
    return (
      <div className="flex flex-col gap-5">
        {errorAlert}
        <div className="flex items-center gap-3 rounded-2xl bg-teal-50 p-4 dark:bg-teal-950">
          <SealCheckIcon
            weight="duotone"
            className="size-7 text-teal-700 dark:text-teal-300"
          />
          <div className="flex flex-col gap-0.5">
            <StatusPill tone="positive" className="self-start">
              {t("identityStep.verified")}
            </StatusPill>
            <p className="text-sm">{t("identityStep.verifiedBody")}</p>
          </div>
        </div>
        <div>
          <Button size="lg" isPending={loading} onPress={() => run(complete)}>
            {t("identityStep.continue")}
          </Button>
        </div>
      </div>
    )
  }

  if (profile.stripeIdentityStatus === "processing") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5 rounded-2xl bg-muted p-4">
          <StatusPill tone="attention" className="self-start">
            {t("identityStep.processing")}
          </StatusPill>
          <p className="text-sm text-muted-foreground">
            {t("identityStep.processingBody")}
          </p>
        </div>
        <div>
          <Button variant="outline" size="lg" onPress={onDone}>
            {t("identityStep.later")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {errorAlert}
      <p className="text-sm text-pretty text-muted-foreground">
        {t("identityStep.intro")}
      </p>
      <div>
        <Button
          size="lg"
          isPending={loading}
          onPress={() => run(startVerification)}
        >
          {loading ? t("identityStep.starting") : t("identityStep.start")}
        </Button>
      </div>
    </div>
  )
}
