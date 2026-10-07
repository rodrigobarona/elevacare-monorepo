import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"
import { formatSessionMode } from "../session-mode"

export interface BookingConfirmedProps {
  memberName: string
  eventTypeName: string
  formattedDate: string
  sessionMode: string
  location?: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
}

export function BookingConfirmedEmail({
  memberName,
  eventTypeName,
  formattedDate,
  sessionMode,
  location,
  locale = "en",
  jsonLd,
}: BookingConfirmedProps) {
  const t = getEmailTranslations(locale)

  return (
    <EmailLayout
      preview={t.subject.newBooking(memberName, formattedDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <EmailHeading>{t.booking.confirmedTitle}</EmailHeading>
      <EmailBodyText className="mb-[8px]">
        {t.booking.greeting(memberName)}
      </EmailBodyText>
      <EmailBodyText className="mb-[24px]">
        {t.booking.confirmedSubtitle}
      </EmailBodyText>

      <EmailCard>
        <DetailRow label={t.labels.member} value={memberName} bold />
        <DetailRow label={t.labels.service} value={eventTypeName} />
        <DetailRow label={t.labels.dateTime} value={formattedDate} />
        <DetailRow
          label={t.labels.mode}
          value={formatSessionMode(sessionMode, locale)}
        />
        {location ? (
          <DetailRow label={t.labels.location} value={location} />
        ) : null}
      </EmailCard>

      <EmailBodyText className="mt-[24px] text-[13px] leading-[20px]">
        {t.booking.icsHintAdd}
      </EmailBodyText>
    </EmailLayout>
  )
}

BookingConfirmedEmail.PreviewProps = {
  memberName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  formattedDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  sessionMode: "in_person",
  location: "Clínica Chiado, Lisboa",
  locale: "pt",
} satisfies BookingConfirmedProps

export default BookingConfirmedEmail
