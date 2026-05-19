"use client"

import * as React from "react"
import {
  ElevaConnectProvider,
  ConnectNotificationBanner,
} from "@eleva/billing/embedded"
import { createApiClient } from "@eleva/api-client"

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
    const api = createApiClient({ baseUrl: apiBaseUrl })
    const data = await api.stripe.accountSession.create({
      components: [
        "notification_banner",
        "account_management",
        "balances",
        "payouts",
        "payments",
        "tax_settings",
      ],
    })
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
