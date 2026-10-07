import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"
import { formatSessionMode } from "../session-mode"

export type BookingReminderWindow = "24h" | "1h"

export interface BookingReminderProps {
  window: BookingReminderWindow
  memberName: string
  eventTypeName: string
  formattedDate: string
  sessionMode: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
}

export function BookingReminderEmail({
  window,
  memberName,
  eventTypeName,
  formattedDate,
  sessionMode,
  locale = "en",
  jsonLd,
}: BookingReminderProps) {
  const t = getEmailTranslations(locale)
  const title =
    window === "24h" ? t.booking.reminder24hTitle : t.booking.reminder1hTitle
  const subtitle =
    window === "24h"
      ? t.booking.reminder24hSubtitle
      : t.booking.reminder1hSubtitle
  const preview =
    window === "24h"
      ? t.subject.reminder24h(memberName, formattedDate)
      : t.subject.reminder1h(memberName, formattedDate)

  return (
    <EmailLayout preview={preview} locale={locale} jsonLd={jsonLd}>
      <EmailHeading>{title}</EmailHeading>
      <EmailBodyText className="mb-[8px]">
        {t.booking.greeting(memberName)}
      </EmailBodyText>
      <EmailBodyText className="mb-[24px]">{subtitle}</EmailBodyText>

      <EmailCard>
        <DetailRow label={t.labels.member} value={memberName} bold />
        <DetailRow label={t.labels.service} value={eventTypeName} />
        <DetailRow label={t.labels.dateTime} value={formattedDate} />
        <DetailRow
          label={t.labels.mode}
          value={formatSessionMode(sessionMode, locale)}
        />
      </EmailCard>
    </EmailLayout>
  )
}

BookingReminderEmail.PreviewProps = {
  window: "24h",
  memberName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  formattedDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  sessionMode: "online",
  locale: "pt",
} satisfies BookingReminderProps

export default BookingReminderEmail
