import { getTranslations, getLocale } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { Badge } from "@eleva/ui/components/badge"
import { LinkButton } from "@eleva/ui/components/button"
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
      <AccountPageHeader title={t("title")} description={t("subtitle")} />

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {formatMoney(payment.amountCents, locale, payment.currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {payment.paidAt
                    ? `${t("paidAt")}: ${new Date(payment.paidAt).toLocaleString(locale)}`
                    : t("session")}
                </p>
                {payment.refundedCents > 0 ? (
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
                <Badge variant="secondary">
                  {isPaymentStatus(payment.status)
                    ? t(`statusLabel.${payment.status}`)
                    : payment.status}
                </Badge>
                {payment.receiptUrl ? (
                  <LinkButton
                    variant="outline"
                    size="sm"
                    href={payment.receiptUrl}
                    target="_blank"
                  >
                    {t("receipt")}
                  </LinkButton>
                ) : null}
                <LinkButton
                  variant="ghost"
                  size="sm"
                  href={`/${orgSlug}/sessions/${payment.bookingId}`}
                >
                  {t("session")}
                </LinkButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
