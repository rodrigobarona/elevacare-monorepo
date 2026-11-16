"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import type { ExpertInvoice, ExpertInvoiceStatus } from "@eleva/api-client"
import { WalletIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { StatusPill, type StatusTone } from "@eleva/ui/components/status-pill"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { toast } from "sonner"
import {
  listMoreExpertInvoicesAction,
  markExpertInvoiceManualAction,
  retryExpertInvoiceAction,
} from "./actions"

const INTL_LOCALE: Record<"en" | "pt" | "es", string> = {
  en: "en-GB",
  pt: "pt-PT",
  es: "es-ES",
}

const ERROR_KEYS = [
  "flag_disabled",
  "not_found",
  "already_issued",
  "not_retryable",
  "already_manual",
  "payment_not_succeeded",
  "forbidden",
  "validation",
  "blocked",
  "conflict",
] as const

function formatEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

function invoiceStatusDisplay(
  status: ExpertInvoiceStatus,
  t: (key: string) => string
): { label: string; tone: StatusTone } {
  switch (status) {
    case "pending":
      return { label: t("invoiceStatus.pending"), tone: "neutral" }
    case "issued":
      return { label: t("invoiceStatus.issued"), tone: "positive" }
    case "failed":
      return { label: t("invoiceStatus.failed"), tone: "attention" }
    case "manual_pending":
      return { label: t("invoiceStatus.manualPending"), tone: "neutral" }
    case "manual_issued":
      return { label: t("invoiceStatus.manualIssued"), tone: "positive" }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function adapterLabel(
  adapter: ExpertInvoice["adapter"],
  t: (key: string) => string
): string {
  switch (adapter) {
    case "toconline":
      return t("adapters.toconline")
    case "moloni":
      return t("adapters.moloni")
    case "manual":
      return t("adapters.manual")
    default: {
      const _exhaustive: never = adapter
      return _exhaustive
    }
  }
}

export function InvoiceList({
  invoices,
  nextCursor,
}: {
  invoices: ExpertInvoice[]
  nextCursor: string | null
}) {
  const t = useTranslations("finance.invoices")
  const rawLocale = useLocale()
  const localeKey = (["en", "pt", "es"] as const).includes(
    rawLocale as "en" | "pt" | "es"
  )
    ? (rawLocale as "en" | "pt" | "es")
    : "en"
  const intlLocale = INTL_LOCALE[localeKey]
  const euros = (cents: number) => formatEuros(cents, intlLocale)
  const serverKey = `${invoices.map((row) => `${row.id}:${row.status}:${row.attempts}`).join("|")}:${nextCursor ?? ""}`
  const [pageState, setPageState] = React.useState({
    serverKey,
    extra: [] as ExpertInvoice[],
    cursor: nextCursor,
  })
  if (pageState.serverKey !== serverKey) {
    setPageState({ serverKey, extra: [], cursor: nextCursor })
  }
  const [loadingMore, setLoadingMore] = React.useState(false)
  const rows = [...invoices, ...pageState.extra]
  const cursor = pageState.cursor

  async function handleLoadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const result = await listMoreExpertInvoicesAction(cursor)
      if (!result.ok) {
        toast.error(t("errors.generic"))
        return
      }
      setPageState((current) => ({
        ...current,
        extra: [...current.extra, ...result.invoices],
        cursor: result.nextCursor,
      }))
    } finally {
      setLoadingMore(false)
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="first-run"
        icon={<WalletIcon aria-hidden />}
        title={t("empty")}
        description={t("emptyHint")}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-3xl border bg-card shadow-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">{t("booking")}</th>
              <th className="px-3 py-3 font-medium">{t("adapter")}</th>
              <th className="px-3 py-3 text-right font-medium">
                {t("amount")}
              </th>
              <th className="px-3 py-3 font-medium">{t("statusLabel")}</th>
              <th className="px-3 py-3 font-medium">{t("issuedAt")}</th>
              <th className="px-5 py-3 font-medium">
                <span className="sr-only">{t("actionsLabel")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                euros={euros}
                intlLocale={intlLocale}
                onUpdated={(updated) => {
                  setPageState((current) => ({
                    ...current,
                    extra: current.extra.map((row) =>
                      row.id === updated.id ? updated : row
                    ),
                  }))
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
      {cursor ? (
        <Button
          variant="outline"
          isDisabled={loadingMore}
          onPress={() => {
            void handleLoadMore()
          }}
        >
          {loadingMore ? t("loadingMore") : t("loadMore")}
        </Button>
      ) : null}
    </div>
  )
}

function InvoiceRow({
  invoice,
  euros,
  intlLocale,
  onUpdated,
}: {
  invoice: ExpertInvoice
  euros: (cents: number) => string
  intlLocale: string
  onUpdated: (invoice: ExpertInvoice) => void
}) {
  const router = useRouter()
  const t = useTranslations("finance.invoices")
  const [pending, setPending] = React.useState(false)
  const [markOpen, setMarkOpen] = React.useState(false)

  const status = invoiceStatusDisplay(invoice.status, t)
  const canRetry = invoice.status === "failed"
  const canMarkManual =
    invoice.status === "failed" || invoice.status === "manual_pending"

  function friendlyError(code: string): string {
    if ((ERROR_KEYS as readonly string[]).includes(code)) {
      return t(`errors.${code}` as Parameters<typeof t>[0])
    }
    return t("errors.generic")
  }

  async function handleRetry() {
    setPending(true)
    try {
      const result = await retryExpertInvoiceAction(invoice.bookingId)
      if (!result.ok) {
        toast.error(friendlyError(result.error))
        return
      }
      toast.success(t("retryQueued"))
      onUpdated(result.invoice)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function handleMarkManual() {
    setPending(true)
    try {
      const result = await markExpertInvoiceManualAction(invoice.bookingId)
      if (!result.ok) {
        toast.error(friendlyError(result.error))
        return
      }
      toast.success(t("markedManual"))
      setMarkOpen(false)
      onUpdated(result.invoice)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <tr className="align-top">
      <td className="px-5 py-4 font-mono text-xs">
        {invoice.bookingId.slice(0, 8)}
      </td>
      <td className="px-3 py-4">{adapterLabel(invoice.adapter, t)}</td>
      <td className="px-3 py-4 text-right tabular-nums">
        {euros(invoice.amountCents)}
      </td>
      <td className="px-3 py-4">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        {invoice.error === "toconline_v1_auto_finalize_blocked" ? (
          <p className="mt-1.5 max-w-60 text-xs text-muted-foreground">
            {t("blocked")}
          </p>
        ) : invoice.error ? (
          <p className="mt-1.5 max-w-60 text-xs text-muted-foreground">
            {t("errors.generic")}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-4 text-muted-foreground tabular-nums">
        {invoice.issuedAt
          ? new Date(invoice.issuedAt).toLocaleString(intlLocale, {
              timeZone: "Europe/Lisbon",
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—"}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap justify-end gap-2">
          {canRetry ? (
            <Button
              size="sm"
              variant="outline"
              isDisabled={pending}
              onPress={() => {
                void handleRetry()
              }}
            >
              {t("retry")}
            </Button>
          ) : null}
          {canMarkManual ? (
            <Button
              size="sm"
              variant="outline"
              isDisabled={pending}
              onPress={() => setMarkOpen(true)}
            >
              {t("markManual")}
            </Button>
          ) : null}
        </div>
        <AlertDialog isOpen={markOpen} onOpenChange={setMarkOpen}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("markManualTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("markManualDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel isDisabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              onPress={() => {
                void handleMarkManual()
              }}
              isDisabled={pending}
            >
              {pending ? t("marking") : t("markManual")}
            </Button>
          </AlertDialogFooter>
        </AlertDialog>
      </td>
    </tr>
  )
}
