import { Section } from "react-email"
import { EmailLayout } from "../components/layout"
import { EmailButton } from "../components/email-button"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import {
  UrgentHelpNote,
  type UrgentHelpDetail,
} from "../components/urgent-help-note"
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
  heading?: string
  subheading?: string
  preview?: string
  /** Hide when this send has no .ics attachment (request declined/expired). */
  showIcsHint?: boolean
  /** Who the email greets; defaults to memberName. */
  greetingName?: string
  /** The other person's row ("Member" for experts, "Expert" for members). */
  counterpartLabel?: string
  counterpartName?: string
  /** Member copy only: where to turn when something cannot wait. */
  urgentHelp?: UrgentHelpDetail
  /** Member copy when the expert cancelled: where to book a new time. */
  rebookHref?: string
}

export function BookingCancelledEmail({
  memberName,
  eventTypeName,
  formattedDate,
  cancellationPolicyName,
  refundAmount,
  locale = "en",
  jsonLd,
  heading,
  subheading,
  preview,
  showIcsHint = true,
  greetingName,
  counterpartLabel,
  counterpartName,
  urgentHelp,
  rebookHref,
}: BookingCancelledProps) {
  const t = getEmailTranslations(locale)

  return (
    <EmailLayout
      preview={preview ?? t.subject.cancelled(memberName, formattedDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <EmailHeading>{heading ?? t.booking.cancelledTitle}</EmailHeading>
      <EmailBodyText className="mb-[8px]">
        {t.booking.greeting(greetingName ?? memberName)}
      </EmailBodyText>
      <EmailBodyText className="mb-[24px]">
        {subheading ?? t.booking.cancelledSubtitle}
      </EmailBodyText>

      <EmailCard variant="muted">
        <DetailRow
          label={counterpartLabel ?? t.labels.member}
          value={counterpartName ?? memberName}
          bold
        />
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

      {rebookHref ? (
        <Section className="mt-[24px]">
          <EmailButton href={rebookHref}>
            {t.booking.bookNewTimeCta}
          </EmailButton>
        </Section>
      ) : null}
      {showIcsHint ? (
        <EmailBodyText className="mt-[24px] text-[13px] leading-[20px]">
          {t.booking.icsHintRemove}
        </EmailBodyText>
      ) : null}
      {urgentHelp ? (
        <UrgentHelpNote locale={locale} detail={urgentHelp} />
      ) : null}
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
