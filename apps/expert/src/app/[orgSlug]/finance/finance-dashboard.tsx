"use client"

import { useLocale, useTranslations } from "next-intl"
import type { FinanceSummaryResponse, PayoutStatus } from "@eleva/api-client"
import {
  ConnectPayouts,
  ConnectBalances,
  ConnectAccountManagement,
  ConnectTaxSettings,
} from "@eleva/billing/embedded"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Separator } from "@eleva/ui/components/separator"
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

function payoutStatusLabel(
  status: PayoutStatus | null,
  t: (key: string) => string
): string {
  if (!status) return t("noPayout")
  switch (status) {
    case "pending":
      return t("status.pending")
    case "scheduled":
      return t("status.scheduled")
    case "approval_required":
      return t("status.approvalRequired")
    case "transferred":
      return t("status.transferred")
    case "paid_out":
      return t("status.paidOut")
    case "failed":
      return t("status.failed")
    case "held":
      return t("status.held")
    case "reversal_pending":
      return t("status.reversalPending")
    case "reversed":
      return t("status.reversed")
    default: {
      const _exhaustive: never = status
      return t("noPayout")
    }
  }
}

export function FinanceDashboard({
  orgSlug,
  summary,
  bookings,
}: FinanceSummaryResponse & { orgSlug: string }) {
  const t = useTranslations("finance")
  const rawLocale = useLocale()
  const localeKey = (["en", "pt", "es"] as const).includes(
    rawLocale as "en" | "pt" | "es"
  )
    ? (rawLocale as "en" | "pt" | "es")
    : "en"
  const intlLocale = INTL_LOCALE[localeKey]
  const euros = (cents: number) => formatEuros(cents, intlLocale)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label={t("gross")} value={euros(summary.grossCents)} />
        <SummaryCard label={t("fees")} value={euros(summary.feesCents)} />
        <SummaryCard label={t("net")} value={euros(summary.netCents)} />
        <SummaryCard label={t("pending")} value={euros(summary.pendingCents)} />
        <SummaryCard label={t("paid")} value={euros(summary.paidCents)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("bookings")}</CardTitle>
          <Button
            variant="outline"
            onPress={() => {
              void (async () => {
                try {
                  const result = await exportFinanceCsv(orgSlug)
                  if (!result.ok) {
                    toast.error(t("exportFailed"))
                    return
                  }
                  if (typeof window === "undefined") return
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
              })()
            }}
          >
            {t("exportCsv")}
          </Button>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">{t("booking")}</th>
                    <th className="py-2 pr-4 font-medium">{t("gross")}</th>
                    <th className="py-2 pr-4 font-medium">{t("fees")}</th>
                    <th className="py-2 pr-4 font-medium">{t("net")}</th>
                    <th className="py-2 pr-4 font-medium">
                      {t("payoutState")}
                    </th>
                    <th className="py-2 font-medium">{t("eligibleAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((row) => (
                    <tr key={row.bookingPaymentId} className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.bookingId.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-4">{euros(row.amountCents)}</td>
                      <td className="py-2 pr-4">{euros(row.feeCents)}</td>
                      <td className="py-2 pr-4">{euros(row.netCents)}</td>
                      <td className="py-2 pr-4">
                        {payoutStatusLabel(row.payoutStatus, t)}
                      </td>
                      <td className="py-2">
                        {row.eligibleAt
                          ? new Date(row.eligibleAt).toLocaleString(intlLocale)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("balance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectBalances />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("payouts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectPayouts />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("accountDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectAccountManagement />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("taxSettings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectTaxSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}
