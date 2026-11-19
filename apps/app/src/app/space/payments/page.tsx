import Link from "next/link"
import { getTranslations, getLocale } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { CreditCardIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { StatusPill, type StatusTone } from "@eleva/ui/components/status-pill"
import { marketplaceExpertsUrl } from "@eleva/config/env"
import { getAuthedApiClient, requireMemberSpace } from "@/lib/member-api"
import { FindExpertButton } from "../_components/booking-card"
import { eventTitle, formatMoney } from "@/lib/member-format"
import { SPACE_BASE } from "@eleva/config/routing"

export const dynamic = "force-dynamic"

/** The states of a payment where money moved; the only ones listed. */
const PAYMENT_STATUS_KEYS = ["succeeded", "refunded", "refund_pending"] as const

type PaymentStatusKey = (typeof PAYMENT_STATUS_KEYS)[number]

function isPaymentStatus(value: string): value is PaymentStatusKey {
  return (PAYMENT_STATUS_KEYS as readonly string[]).includes(value)
}

function paymentTone(status: PaymentStatusKey | null): StatusTone {
  switch (status) {
    case "succeeded":
      return "positive"
    case "refund_pending":
      return "attention"
    case "refunded":
    case null:
      return "neutral"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export default async function PaymentsPage() {
  await requireMemberSpace()
  const [t, locale, api] = await Promise.all([
    getTranslations("payments"),
    getLocale(),
    getAuthedApiClient(),
  ])
  // Only money that moved. A free session records a payment of zero and
  // an abandoned checkout records one that never completed; neither is a
  // payment to show.
  const { payments } = await api.me.listPayments({ charged: "true" })
  // Dates read in the session's own time zone, as on the session page.
  const day = (iso: string, timeZone?: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(
      new Date(iso)
    )

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} />

      {payments.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon />}
          title={t("empty")}
          description={t("emptyHint")}
          action={<FindExpertButton href={marketplaceExpertsUrl(locale)} />}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
          {payments.map((payment) => {
            const status = isPaymentStatus(payment.status)
              ? payment.status
              : null
            const refund =
              payment.refundedCents > 0
                ? formatMoney(payment.refundedCents, locale, payment.currency)
                : null
            // The pill names the state; the text beside it adds only what
            // the pill does not say: when it was paid, or how much came
            // back.
            const paidDay = payment.paidAt
              ? day(payment.paidAt, payment.session?.timezone)
              : null
            // A full refund is the row's own amount; it is not said twice.
            const partRefund =
              payment.refundedCents < payment.amountCents ? refund : null
            const facts = (
              status === "succeeded"
                ? [paidDay, refund ? t("refunded", { amount: refund }) : null]
                : [partRefund]
            )
              .filter((fact) => fact !== null)
              .join(" · ")
            const sessionHref = `${SPACE_BASE}/sessions/${payment.bookingId}`
            return (
              <li
                key={payment.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-5"
                data-testid="member-payment-row"
                data-status={payment.status}
                data-booking={payment.bookingId}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display text-lg leading-snug font-medium tracking-tight">
                    <Link
                      href={sessionHref}
                      data-testid="member-payment-session"
                      className="rounded-sm underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {payment.session
                        ? eventTitle(payment.session.title, locale)
                        : t("session")}
                    </Link>
                  </p>
                  {payment.session ? (
                    <p className="text-sm text-muted-foreground">
                      {t("sessionLine", {
                        name: payment.session.expertName,
                        date: day(
                          payment.session.startsAt,
                          payment.session.timezone
                        ),
                      })}
                    </p>
                  ) : null}
                  <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                    <StatusPill tone={paymentTone(status)}>
                      {status ? t(`statusLabel.${status}`) : payment.status}
                    </StatusPill>
                    {facts ? <span>{facts}</span> : null}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <p className="font-display text-xl font-normal tracking-tight tabular-nums">
                    {formatMoney(payment.amountCents, locale, payment.currency)}
                  </p>
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
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
