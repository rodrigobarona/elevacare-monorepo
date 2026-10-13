import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export interface BookingCancelledProps {
  memberName: string
  eventTypeName: string
  formattedDate: string
  cancellationPolicyName?: string
  /** Formatted refund amount; omitted when no refund was decided. */
  refundAmount?: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
}

export function BookingCancelledEmail({
  memberName,
  eventTypeName,
  formattedDate,
  cancellationPolicyName,
  refundAmount,
  locale = "en",
  jsonLd,
}: BookingCancelledProps) {
  const t = getEmailTranslations(locale)

  return (
    <EmailLayout
      preview={t.subject.cancelled(memberName, formattedDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <EmailHeading>{t.booking.cancelledTitle}</EmailHeading>
      <EmailBodyText className="mb-[8px]">
        {t.booking.greeting(memberName)}
      </EmailBodyText>
      <EmailBodyText className="mb-[24px]">
        {t.booking.cancelledSubtitle}
      </EmailBodyText>

      <EmailCard variant="muted">
        <DetailRow label={t.labels.member} value={memberName} bold />
        <DetailRow label={t.labels.service} value={eventTypeName} />
        <DetailRow
          label={t.labels.wasScheduled}
          value={formattedDate}
          valueClassName="text-danger"
        />
        {cancellationPolicyName ? (
          <DetailRow
            label={t.labels.cancellationPolicy}
            value={cancellationPolicyName}
          />
        ) : null}
        {refundAmount ? (
          <DetailRow label={t.labels.refund} value={refundAmount} bold />
        ) : null}
      </EmailCard>

      <EmailBodyText className="mt-[24px] text-[13px] leading-[20px]">
        {t.booking.icsHintRemove}
      </EmailBodyText>
    </EmailLayout>
  )
}

BookingCancelledEmail.PreviewProps = {
  memberName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  formattedDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  cancellationPolicyName: "Moderada",
  refundAmount: "30,00 €",
  locale: "pt",
} satisfies BookingCancelledProps

export default BookingCancelledEmail
