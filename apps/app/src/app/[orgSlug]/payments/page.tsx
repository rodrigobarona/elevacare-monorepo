import { getTranslations, getLocale } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { ArrowsClockwiseIcon, CreditCardIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { formatMoney } from "@/lib/member-format"

export const dynamic = "force-dynamic"

const PAYMENT_STATUS_KEYS = [
  "intent_pending",
  "requires_payment",
  "succeeded",
  "failed",
  "refunded",
  "refund_pending",
] as const

type PaymentStatusKey = (typeof PAYMENT_STATUS_KEYS)[number]

function isPaymentStatus(value: string): value is PaymentStatusKey {
  return (PAYMENT_STATUS_KEYS as readonly string[]).includes(value)
}

function paymentTone(status: PaymentStatusKey | null): string {
  switch (status) {
    case "succeeded":
      return "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
    case "intent_pending":
    case "requires_payment":
    case "refund_pending":
      return "bg-coral-50 text-coral-800 dark:bg-coral-950 dark:text-coral-200"
    case "failed":
      return "bg-destructive/10 text-destructive"
    case "refunded":
    case null:
      return "bg-muted text-muted-foreground"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await requireMemberOrg(orgSlug)
  const [t, locale, api] = await Promise.all([
    getTranslations("payments"),
    getLocale(),
    getAuthedApiClient(),
  ])
  const { payments } = await api.me.listPayments()

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {payments.length === 0 ? (
        <EmptyState icon={<CreditCardIcon />} title={t("empty")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
          {payments.map((payment) => {
            const status = isPaymentStatus(payment.status)
              ? payment.status
              : null
            const refunded = payment.refundedCents > 0
            return (
              <li
                key={payment.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6"
                data-testid="member-payment-row"
                data-status={payment.status}
                data-booking={payment.bookingId}
              >
                <div
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-foreground dark:bg-muted"
                >
                  {refunded ? (
                    <ArrowsClockwiseIcon className="size-5" />
                  ) : (
                    <CreditCardIcon className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-display text-xl font-normal tracking-tight tabular-nums">
                    {formatMoney(payment.amountCents, locale, payment.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {payment.paidAt
                      ? `${t("paidAt")} ${new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(payment.paidAt))}`
                      : t("session")}
                  </p>
                  {refunded ? (
                    <p className="text-sm text-muted-foreground">
                      {t("refunded", {
                        amount: formatMoney(
                          payment.refundedCents,
                          locale,
                          payment.currency
                        ),
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      paymentTone(status)
                    )}
                  >
                    {status ? t(`statusLabel.${status}`) : payment.status}
                  </span>
                  {payment.receiptUrl ? (
                    <LinkButton
                      variant="outline"
                      size="sm"
                      href={payment.receiptUrl}
                      target="_blank"
                      data-testid="member-payment-receipt"
                    >
                      {t("receipt")}
                    </LinkButton>
                  ) : null}
                  <LinkButton
                    variant="ghost"
                    size="sm"
                    href={`/${orgSlug}/sessions/${payment.bookingId}`}
                    data-testid="member-payment-session"
                  >
                    {t("session")}
                  </LinkButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
