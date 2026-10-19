"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { createApiClient } from "@eleva/api-client"
import { WalletIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { toast } from "sonner"

export function FinanceConnectPrompt({ apiBaseUrl }: { apiBaseUrl: string }) {
  const t = useTranslations("finance.connect")
  const router = useRouter()
  const [isStarting, setIsStarting] = React.useState(false)

  async function handleStart() {
    setIsStarting(true)
    try {
      const api = createApiClient({ baseUrl: apiBaseUrl })
      await api.stripe.connectAccount.create({})
      router.refresh()
    } catch {
      toast.error(t("error"))
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <EmptyState
      title={t("title")}
      description={t("description")}
      icon={<WalletIcon />}
      action={
        <Button onPress={() => void handleStart()} isDisabled={isStarting}>
          {isStarting ? t("starting") : t("start")}
        </Button>
      }
    />
  )
}
