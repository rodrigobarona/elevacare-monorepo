"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import type { ExpertInvoice, ExpertInvoiceStatus } from "@eleva/api-client"
import { WalletIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { MetaLine } from "@eleva/ui/components/meta-line"
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

/**
 * Issuing through the provider is closed for this invoice: the expert
 * issues it in her own software. Sending it again would end the same way.
 */
const ISSUE_YOURSELF_ERROR = "toconline_v1_auto_finalize_blocked"

/** An invoice the expert issues herself and then marks here. */
function isToIssue(invoice: ExpertInvoice): boolean {
  return (
    invoice.status === "manual_pending" ||
    (invoice.status === "failed" && invoice.error === ISSUE_YOURSELF_ERROR)
  )
}

function invoiceStatusDisplay(
  invoice: ExpertInvoice,
  t: (key: string) => string
): { label: string; tone: StatusTone } {
  // A to-do, not a failure: quiet, so a real failure stands out.
  if (isToIssue(invoice)) {
    return { label: t("invoiceStatus.manualPending"), tone: "neutral" }
  }
  const status: ExpertInvoiceStatus = invoice.status
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
              <th scope="col" className="px-5 py-3 font-medium">
                {t("booking")}
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                {t("amount")}
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                {t("statusLabel")}
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                {t("issuedAt")}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
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

  const status = invoiceStatusDisplay(invoice, t)
  const toIssue = isToIssue(invoice)
  // Sending again only helps an invoice that failed on its way; one the
  // expert issues herself has a single next step, marking it.
  const canRetry = invoice.status === "failed" && !toIssue
  const canMarkManual = invoice.status === "failed" || toIssue
  // The practice's own time, as the Issued on column.
  const sessionDay = invoice.session
    ? new Date(invoice.session.startsAt).toLocaleDateString(intlLocale, {
        timeZone: "Europe/Lisbon",
        dateStyle: "medium",
      })
    : null
  // Who and when, to tell one row's buttons and dialog from another's.
  const sessionName = sessionDay
    ? [invoice.session?.memberName, sessionDay].filter(Boolean).join(", ")
    : t("booking")

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
      onUpdated({ ...result.invoice, session: invoice.session })
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
      onUpdated({ ...result.invoice, session: invoice.session })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <tr className="align-middle">
      <th scope="row" className="px-5 py-4 text-left font-normal">
        {/* Named after the session: who it was with and when. */}
        {sessionDay ? (
          <MetaLine
            items={
              invoice.session?.memberName
                ? [
                    <span key="name" className="font-medium">
                      {invoice.session.memberName}
                    </span>,
                    sessionDay,
                  ]
                : [sessionDay]
            }
          />
        ) : (
          t("booking")
        )}
      </th>
      <td className="px-3 py-4 text-right tabular-nums">
        {euros(invoice.amountCents)}
      </td>
      <td className="px-3 py-4">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        {invoice.error && !toIssue ? (
          <p className="mt-1.5 max-w-60 text-xs text-muted-foreground">
            {t("failedHint")}
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
              aria-label={t("retryNamed", { session: sessionName })}
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
              aria-label={t("markManualNamed", { session: sessionName })}
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
              {/* Which invoice: marking it cannot be undone here. */}
              <span className="mb-2 block font-medium text-foreground">
                {sessionName}
                {" · "}
                {euros(invoice.amountCents)}
              </span>
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
