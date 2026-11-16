"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { WalletIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { toast } from "sonner"
import { practiceApiClient, usePracticeSlug } from "@/lib/practice-api-client"

export function FinanceConnectPrompt({ apiBaseUrl }: { apiBaseUrl: string }) {
  const orgSlug = usePracticeSlug()
  const t = useTranslations("finance.connect")
  const router = useRouter()
  const [isStarting, setIsStarting] = React.useState(false)

  async function handleStart() {
    setIsStarting(true)
    try {
      const api = practiceApiClient(apiBaseUrl, orgSlug)
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
