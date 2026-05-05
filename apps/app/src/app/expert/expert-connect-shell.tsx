"use client"

import * as React from "react"
import {
  ElevaConnectProvider,
  ConnectNotificationBanner,
} from "@eleva/billing/embedded"

interface Props {
  apiBaseUrl: string
  stripePublishableKey: string
  children: React.ReactNode
}

export function ExpertConnectShell({
  apiBaseUrl,
  stripePublishableKey,
  children,
}: Props) {
  const fetchClientSecret = React.useCallback(async () => {
    const res = await fetch(`${apiBaseUrl}/stripe/account-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        components: [
          "notification_banner",
          "account_management",
          "balances",
          "payouts",
          "payments",
          "tax_settings",
        ],
      }),
    })
    if (!res.ok) throw new Error("Failed to fetch Connect session")
    const data = (await res.json()) as { clientSecret: string }
    return data.clientSecret
  }, [apiBaseUrl])

  return (
    <ElevaConnectProvider
      publishableKey={stripePublishableKey}
      fetchClientSecret={fetchClientSecret}
    >
      <ConnectNotificationBanner />
      {children}
    </ElevaConnectProvider>
  )
}
