"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  ElevaConnectProvider,
  ConnectAccountOnboarding,
} from "@eleva/billing/embedded"
import { markStepComplete } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

interface Props {
  profile: OnboardingProfile
  apiBaseUrl: string
  stripePublishableKey: string
  onDone: () => void
}

export function StepConnect({
  profile,
  apiBaseUrl,
  stripePublishableKey,
  onDone,
}: Props) {
  const [error, setError] = React.useState<string | null>(null)

  const fetchClientSecret = React.useCallback(async () => {
    const res = await fetch(`${apiBaseUrl}/stripe/account-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ components: ["account_onboarding"] }),
    })
    if (!res.ok) throw new Error("Failed to fetch Connect session")
    const data = (await res.json()) as { clientSecret: string }
    return data.clientSecret
  }, [apiBaseUrl])

  if (!profile.stripeAccountId) {
    return (
      <Alert>
        <AlertDescription>
          Your Stripe Connect account has not been provisioned yet. This happens
          when the admin approves your application. Please check back later.
        </AlertDescription>
      </Alert>
    )
  }

  if (!stripePublishableKey) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Stripe configuration is missing. Please contact support.
        </AlertDescription>
      </Alert>
    )
  }

  async function handleExit() {
    const result = await markStepComplete("connect")
    if (result.ok) onDone()
    else setError(result.error)
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Complete your Stripe Connect setup to receive payments. This is handled
        entirely inline — no redirects needed.
      </p>

      <ElevaConnectProvider
        publishableKey={stripePublishableKey}
        fetchClientSecret={fetchClientSecret}
      >
        <ConnectAccountOnboarding onExit={() => void handleExit()} />
      </ElevaConnectProvider>

      <Button variant="outline" size="sm" onClick={() => void handleExit()}>
        I&apos;ll finish this later
      </Button>
    </div>
  )
}
