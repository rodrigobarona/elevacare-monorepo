"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  ElevaConnectProvider,
  ConnectAccountOnboarding,
} from "@eleva/billing/embedded"
import { createApiClient } from "@eleva/api-client"
import { markStepComplete } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

interface Props {
  profile: OnboardingProfile
  apiBaseUrl: string
  stripePublishableKey: string
  onDone: () => void
}

function requirementMessage(t: (key: string) => string, key: string): string {
  if (key.startsWith("individual.verification")) {
    return t("requirements.verification")
  }
  if (key.startsWith("external_account")) {
    return t("requirements.bank")
  }
  if (key.startsWith("tos_acceptance")) {
    return t("requirements.tos")
  }
  if (key.startsWith("business_profile")) {
    return t("requirements.business")
  }
  return t("requirements.other")
}

export function StepConnect({
  profile,
  apiBaseUrl,
  stripePublishableKey,
  onDone,
}: Props) {
  const t = useTranslations("onboarding")
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [provisioning, setProvisioning] = React.useState(false)

  const fetchClientSecret = React.useCallback(async () => {
    const api = createApiClient({ baseUrl: apiBaseUrl })
    const data = await api.stripe.accountSession.create({
      components: ["account_onboarding"],
    })
    return data.clientSecret
  }, [apiBaseUrl])

  async function handleProvision() {
    setProvisioning(true)
    setError(null)
    try {
      const api = createApiClient({ baseUrl: apiBaseUrl })
      await api.stripe.connectAccount.create({})
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.error"))
    } finally {
      setProvisioning(false)
    }
  }

  async function handleExit() {
    try {
      const result = await markStepComplete("connect")
      if (result.ok) onDone()
      else setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.error"))
    }
  }

  const due = profile.requirementsCurrentlyDue
  const uniqueDue = [...new Set(due.map((key) => requirementMessage(t, key)))]

  if (!profile.stripeAccountId) {
    return (
      <div className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("payments.intro")}</p>
        <Button
          onPress={() => void handleProvision()}
          isDisabled={provisioning}
        >
          {provisioning ? t("payments.provisioning") : t("payments.start")}
        </Button>
      </div>
    )
  }

  if (!stripePublishableKey) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t("payments.missingStripe")}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">{t("payments.intro")}</p>

      {uniqueDue.length > 0 ? (
        <Alert>
          <AlertDescription>
            <p className="font-medium">{t("requirements.title")}</p>
            <ul className="mt-2 list-disc pl-5">
              {uniqueDue.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <ElevaConnectProvider
        publishableKey={stripePublishableKey}
        fetchClientSecret={fetchClientSecret}
      >
        <ConnectAccountOnboarding onExit={() => void handleExit()} />
      </ElevaConnectProvider>

      <Button variant="outline" size="sm" onPress={() => void handleExit()}>
        {t("payments.later")}
      </Button>
    </div>
  )
}
