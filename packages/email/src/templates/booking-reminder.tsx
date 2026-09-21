import { Section, Text } from "react-email"
import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { getEmailTranslations, type EmailLocale } from "../i18n"

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
      <Section className="border-stroke bg-bg rounded-xl border p-8">
        <Text className="text-fg m-0 mb-1 text-[22px] leading-tight font-semibold tracking-tight">
          {title}
        </Text>
        <Text className="text-fg-3 m-0 mb-6 text-[14px] leading-relaxed">
          {subtitle}
        </Text>

        <Section className="bg-bg-2 rounded-lg p-5">
          <DetailRow label={t.labels.member} value={memberName} bold />
          <DetailRow label={t.labels.service} value={eventTypeName} />
          <DetailRow label={t.labels.dateTime} value={formattedDate} />
          <DetailRow label={t.labels.mode} value={sessionMode} />
        </Section>
      </Section>
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
