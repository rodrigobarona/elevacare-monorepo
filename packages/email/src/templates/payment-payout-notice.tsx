import { Section, Text } from "react-email"
import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import {
  getEmailTranslations,
  type EmailLocale,
  type EmailTranslations,
} from "../i18n"

export type PaymentPayoutNoticeKind =
  | "payment.failed"
  | "payment.receipt"
  | "payout.paid"
  | "payout.approval_required"

export interface PaymentPayoutNoticeProps {
  kind: PaymentPayoutNoticeKind
  amountFormatted: string
  reference: string
  name?: string
  locale?: EmailLocale
}

function copyForKind(
  t: EmailTranslations,
  kind: PaymentPayoutNoticeKind
): { title: string; subtitle: string; subject: string } {
  switch (kind) {
    case "payment.failed":
      return {
        title: t.payment.failedTitle,
        subtitle: t.payment.failedSubtitle,
        subject: t.subject.paymentFailed,
      }
    case "payment.receipt":
      return {
        title: t.payment.receiptTitle,
        subtitle: t.payment.receiptSubtitle,
        subject: t.subject.paymentReceipt,
      }
    case "payout.paid":
      return {
        title: t.payout.paidTitle,
        subtitle: t.payout.paidSubtitle,
        subject: t.subject.payoutPaid,
      }
    case "payout.approval_required":
      return {
        title: t.payout.approvalTitle,
        subtitle: t.payout.approvalSubtitle,
        subject: t.subject.payoutApprovalRequired,
      }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function PaymentPayoutNoticeEmail({
  kind,
  amountFormatted,
  reference,
  name,
  locale = "en",
}: PaymentPayoutNoticeProps) {
  const t = getEmailTranslations(locale)
  const copy = copyForKind(t, kind)
  const greeting = name ? t.invoice.greeting(name) : null

  return (
    <EmailLayout preview={copy.subject} locale={locale}>
      <Section className="border-stroke bg-bg rounded-xl border p-8">
        <Text className="text-fg m-0 mb-1 text-[22px] leading-tight font-semibold tracking-tight">
          {copy.title}
        </Text>
        {greeting ? (
          <Text className="text-fg-3 m-0 mb-2 text-[14px] leading-relaxed">
            {greeting}
          </Text>
        ) : null}
        <Text className="text-fg-3 m-0 mb-6 text-[14px] leading-relaxed">
          {copy.subtitle}
        </Text>
        <Section className="bg-bg-2 rounded-lg p-5">
          <DetailRow label={t.labels.amount} value={amountFormatted} bold />
          <DetailRow label={t.labels.reference} value={reference} />
        </Section>
      </Section>
    </EmailLayout>
  )
}

PaymentPayoutNoticeEmail.PreviewProps = {
  kind: "payment.receipt",
  amountFormatted: "€60.00",
  reference: "pay_demo",
  name: "Ada",
  locale: "en",
} satisfies PaymentPayoutNoticeProps

export default PaymentPayoutNoticeEmail
