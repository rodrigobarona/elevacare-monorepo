"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { FinanceSummaryResponse, PayoutStatus } from "@eleva/api-client"
import {
  ConnectPayouts,
  ConnectBalances,
  ConnectAccountManagement,
  ConnectTaxSettings,
} from "@eleva/billing/embedded"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { Section, Stat, StatGrid } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import type { StatusTone } from "@eleva/ui/components/status-pill"
import { toast } from "sonner"
import { exportFinanceCsv } from "./actions"

const INTL_LOCALE: Record<"en" | "pt" | "es", string> = {
  en: "en-GB",
  pt: "pt-PT",
  es: "es-ES",
}

function formatEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

function payoutStatusDisplay(
  status: PayoutStatus | null,
  t: (key: string) => string
): { label: string; tone: StatusTone } {
  if (!status) return { label: t("noPayout"), tone: "neutral" }
  switch (status) {
    case "pending":
      return { label: t("status.pending"), tone: "neutral" }
    case "scheduled":
      return { label: t("status.scheduled"), tone: "neutral" }
    case "approval_required":
      return { label: t("status.approvalRequired"), tone: "attention" }
    case "transferred":
      return { label: t("status.transferred"), tone: "positive" }
    case "paid_out":
      return { label: t("status.paidOut"), tone: "positive" }
    case "failed":
      return { label: t("status.failed"), tone: "attention" }
    case "held":
      return { label: t("status.held"), tone: "attention" }
    case "reversal_pending":
      return { label: t("status.reversalPending"), tone: "attention" }
    case "reversed":
      return { label: t("status.reversed"), tone: "neutral" }
    default: {
      const _exhaustive: never = status
      return { label: t("noPayout"), tone: "neutral" }
    }
  }
}

export function FinanceDashboard({
  orgSlug,
  invoicesHref,
  summary,
  bookings,
  showStripePanels,
}: FinanceSummaryResponse & {
  orgSlug: string
  invoicesHref: string | null
  showStripePanels: boolean
}) {
  const t = useTranslations("finance")
  const rawLocale = useLocale()
  const localeKey = (["en", "pt", "es"] as const).includes(
    rawLocale as "en" | "pt" | "es"
  )
    ? (rawLocale as "en" | "pt" | "es")
    : "en"
  const intlLocale = INTL_LOCALE[localeKey]
  const euros = (cents: number) => formatEuros(cents, intlLocale)
  const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  async function handleExport() {
    try {
      const result = await exportFinanceCsv(orgSlug)
      if (!result.ok) {
        toast.error(t("exportFailed"))
        return
      }
      const blob = new Blob([result.csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "finance.csv"
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t("exportFailed"))
    }
  }

  return (
    <div className="space-y-10">
      <StatGrid className="gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
        <Stat
          label={t("net")}
          value={euros(summary.netCents)}
          hint={t("netHint", {
            gross: euros(summary.grossCents),
            fees: euros(summary.feesCents),
          })}
        />
        <Stat
          label={t("pending")}
          value={euros(summary.pendingCents)}
          hint={t("pendingHint")}
        />
        <Stat
          label={t("paid")}
          value={euros(summary.paidCents)}
          hint={t("paidHint")}
        />
      </StatGrid>

      <Section
        title={t("bookings")}
        description={t("bookingsHint")}
        actions={
          <div className="flex flex-wrap gap-2">
            {invoicesHref ? (
              <LinkButton href={invoicesHref} variant="outline" size="sm">
                {t("invoices.link")}
              </LinkButton>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onPress={() => void handleExport()}
            >
              {t("exportCsv")}
            </Button>
          </div>
        }
      >
        {bookings.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-sand-300 bg-sand-50/70 p-6 text-sm text-muted-foreground dark:border-border dark:bg-card">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-3xl border bg-card shadow-1">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("booking")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("gross")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("fees")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    {t("net")}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("payoutState")}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {t("eligibleAt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((row) => {
                  const payout = payoutStatusDisplay(row.payoutStatus, t)
                  return (
                    <tr
                      key={row.bookingPaymentId}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {row.bookingId.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {euros(row.amountCents)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                        {euros(row.feeCents)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {euros(row.netCents)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={payout.tone}>
                          {payout.label}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {row.eligibleAt
                          ? dateFormatter.format(new Date(row.eligibleAt))
                          : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {showStripePanels ? (
        <Section title={t("stripeTitle")} description={t("stripeHint")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={t("balance")}>
              <ConnectBalances />
            </Panel>
            <Panel title={t("payouts")}>
              <ConnectPayouts />
            </Panel>
            <Panel title={t("accountDetails")}>
              <ConnectAccountManagement />
            </Panel>
            <Panel title={t("taxSettings")}>
              <ConnectTaxSettings />
            </Panel>
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-1">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}
