"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import type { ExpertInvoice, ExpertInvoiceStatus } from "@eleva/api-client"
import { Button } from "@eleva/ui/components/button"
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

function invoiceStatusLabel(
  status: ExpertInvoiceStatus,
  t: (key: string) => string
): string {
  switch (status) {
    case "pending":
      return t("invoiceStatus.pending")
    case "issued":
      return t("invoiceStatus.issued")
    case "failed":
      return t("invoiceStatus.failed")
    case "manual_pending":
      return t("invoiceStatus.manualPending")
    case "manual_issued":
      return t("invoiceStatus.manualIssued")
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
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium">{t("booking")}</th>
              <th className="py-2 pr-4 font-medium">{t("adapter")}</th>
              <th className="py-2 pr-4 font-medium">{t("amount")}</th>
              <th className="py-2 pr-4 font-medium">{t("statusLabel")}</th>
              <th className="py-2 pr-4 font-medium">{t("issuedAt")}</th>
              <th className="py-2 font-medium">{t("actionsLabel")}</th>
            </tr>
          </thead>
          <tbody>
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
    <tr className="border-b align-top">
      <td className="py-2 pr-4 font-mono text-xs">
        {invoice.bookingId.slice(0, 8)}
      </td>
      <td className="py-2 pr-4">{adapterLabel(invoice.adapter, t)}</td>
      <td className="py-2 pr-4">{euros(invoice.amountCents)}</td>
      <td className="py-2 pr-4">
        <div>{invoiceStatusLabel(invoice.status, t)}</div>
        {invoice.error === "toconline_v1_auto_finalize_blocked" ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("blocked")}</p>
        ) : invoice.error ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("errors.generic")}
          </p>
        ) : null}
      </td>
      <td className="py-2 pr-4">
        {invoice.issuedAt
          ? new Date(invoice.issuedAt).toLocaleString(intlLocale)
          : "—"}
      </td>
      <td className="py-2">
        <div className="flex flex-wrap gap-2">
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
