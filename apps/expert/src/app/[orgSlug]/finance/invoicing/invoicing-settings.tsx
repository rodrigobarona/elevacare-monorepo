"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { WalletIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { StatusPill } from "@eleva/ui/components/status-pill"
import type { StatusTone } from "@eleva/ui/components/status-pill"
import { InvoicingProviderPicker } from "@/app/[orgSlug]/_components/invoicing-provider-picker"
import { startToconlineOAuth } from "@/app/[orgSlug]/setup/actions"
import { disconnectInvoicing } from "./actions"

type Health = "connected" | "manual" | "attention"

const HEALTH_TONE: Record<Health, StatusTone> = {
  connected: "positive",
  manual: "neutral",
  attention: "attention",
}

const PROVIDERS = ["toconline", "moloni", "manual"] as const
type Provider = (typeof PROVIDERS)[number]

function isProvider(value: string | null): value is Provider {
  return value !== null && (PROVIDERS as readonly string[]).includes(value)
}

interface Props {
  provider: string | null
  setupStatus: string
  connectionStatus: string | null
  connectedAt: string | null
  invoicingError?: string
  justConnected: boolean
  toconlineEnabled: boolean
}

function healthOf(
  provider: Provider,
  setupStatus: string,
  connectionStatus: string | null
): Health {
  if (provider === "manual") return "manual"
  if (setupStatus === "connected" && connectionStatus === "connected") {
    return "connected"
  }
  return "attention"
}

export function InvoicingSettings({
  provider,
  setupStatus,
  connectionStatus,
  connectedAt,
  invoicingError,
  justConnected,
  toconlineEnabled,
}: Props) {
  const t = useTranslations("finance.invoicing")
  const tAdapters = useTranslations("onboarding.invoicing.adapters")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (!justConnected) return
    toast.success(t("connectedToast"))
    router.replace(pathname)
  }, [justConnected, pathname, router, t])

  const isSetUp =
    isProvider(provider) &&
    (setupStatus === "connected" ||
      setupStatus === "manual_acknowledged" ||
      setupStatus === "expired")

  if (!isSetUp) {
    return (
      <InvoicingProviderPicker
        onSaved={() => {
          toast.success(t("savedToast"))
          router.refresh()
        }}
        invoicingError={invoicingError}
        toconlineEnabled={toconlineEnabled}
      />
    )
  }

  const health = healthOf(provider, setupStatus, connectionStatus)
  const providerName = tAdapters(`${provider}.name`)
  const since = connectedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
        new Date(connectedAt)
      )
    : null

  async function handleReconnect() {
    setPending(true)
    const result = await startToconlineOAuth()
    if (result.ok) {
      window.location.assign(result.url)
      return
    }
    setPending(false)
    toast.error(t("reconnectFailed"))
  }

  async function handleDisconnect() {
    setPending(true)
    const result = await disconnectInvoicing()
    setPending(false)
    if (!result.ok) {
      toast.error(t("disconnectFailed"))
      return
    }
    setConfirmOpen(false)
    toast.success(
      provider === "manual"
        ? t("changedToast")
        : t("disconnectedToast", { provider: providerName })
    )
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5 rounded-3xl border bg-card p-6 shadow-1">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200 [&_svg]:size-5"
        >
          <WalletIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{providerName}</h3>
          <p className="text-sm text-muted-foreground">
            {t(`health.${health}.body`)}
          </p>
          {since ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("connectedSince", { date: since })}
            </p>
          ) : null}
        </div>
        <StatusPill tone={HEALTH_TONE[health]}>
          {t(`health.${health}.label`)}
        </StatusPill>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {health === "attention" && provider === "toconline" ? (
          <Button
            size="sm"
            isDisabled={pending || !toconlineEnabled}
            onPress={() => void handleReconnect()}
          >
            {t("reconnect")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          isDisabled={pending}
          onPress={() => setConfirmOpen(true)}
          data-testid="invoicing-disconnect"
        >
          {provider === "manual" ? t("changeMethod") : t("disconnect")}
        </Button>
      </div>

      <AlertDialog isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {provider === "manual"
              ? t("confirm.changeTitle")
              : t("confirm.disconnectTitle", { provider: providerName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {provider === "manual"
              ? t("confirm.changeBody")
              : t("confirm.disconnectBody", { provider: providerName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending}>
            {t("confirm.cancel")}
          </AlertDialogCancel>
          <Button
            variant={provider === "manual" ? "default" : "destructive"}
            isDisabled={pending}
            onPress={() => void handleDisconnect()}
          >
            {provider === "manual"
              ? t("confirm.changeAction")
              : t("confirm.disconnectAction")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  )
}
