import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
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
      <EmailHeading>{copy.title}</EmailHeading>
      {greeting ? (
        <EmailBodyText className="mb-[8px]">{greeting}</EmailBodyText>
      ) : null}
      <EmailBodyText className="mb-[24px]">{copy.subtitle}</EmailBodyText>
      <EmailCard>
        <DetailRow label={t.labels.amount} value={amountFormatted} bold />
        <DetailRow label={t.labels.reference} value={reference} />
      </EmailCard>
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
