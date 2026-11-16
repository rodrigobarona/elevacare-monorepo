"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ConnectAccountOnboarding,
  ElevaConnectProvider,
} from "@eleva/billing/embedded"
import { Section } from "@eleva/ui/components/page-header"
import { practiceApiClient, usePracticeSlug } from "@/lib/practice-api-client"

/**
 * Shown when the expert has a Stripe account but Stripe still needs
 * their details (skipped or left the setup step). Mounts Stripe's
 * onboarding inline so they can finish here instead of hunting for
 * the setup wizard.
 */
export function FinanceFinishSetup({
  apiBaseUrl,
  stripePublishableKey,
}: {
  apiBaseUrl: string
  stripePublishableKey: string
}) {
  const orgSlug = usePracticeSlug()
  const t = useTranslations("finance.finishSetup")
  const router = useRouter()

  const fetchClientSecret = React.useCallback(async () => {
    const api = practiceApiClient(apiBaseUrl, orgSlug)
    const data = await api.stripe.accountSession.create({
      components: ["account_onboarding"],
    })
    return data.clientSecret
  }, [apiBaseUrl, orgSlug])

  return (
    <Section title={t("title")} description={t("description")}>
      <div className="rounded-3xl border bg-card p-5 shadow-1">
        <ElevaConnectProvider
          publishableKey={stripePublishableKey}
          fetchClientSecret={fetchClientSecret}
        >
          <ConnectAccountOnboarding onExit={() => router.refresh()} />
        </ElevaConnectProvider>
      </div>
    </Section>
  )
}
