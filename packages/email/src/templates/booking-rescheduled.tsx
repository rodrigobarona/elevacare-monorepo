import { Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import { DetailRow } from "./detail-row"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export interface BookingRescheduledProps {
  patientName: string
  eventTypeName: string
  previousDate: string
  newDate: string
  sessionMode: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
}

export function BookingRescheduledEmail({
  patientName,
  eventTypeName,
  previousDate,
  newDate,
  sessionMode,
  locale = "en",
  jsonLd,
}: BookingRescheduledProps) {
  const t = getEmailTranslations(locale)

  return (
    <EmailLayout
      preview={t.subject.rescheduled(patientName, newDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <Section className="border-stroke bg-bg rounded-xl border p-8">
        <Text className="text-fg m-0 mb-1 text-[22px] leading-tight font-semibold tracking-tight">
          {t.booking.rescheduledTitle}
        </Text>
        <Text className="text-fg-3 m-0 mb-6 text-[14px] leading-relaxed">
          {t.booking.rescheduledSubtitle}
        </Text>

        <Section className="bg-bg-2 rounded-lg p-5">
          <DetailRow label={t.labels.patient} value={patientName} bold />
          <DetailRow label={t.labels.service} value={eventTypeName} />
          <DetailRow
            label={t.labels.previous}
            value={previousDate}
            valueClassName="text-danger line-through"
          />
          <DetailRow
            label={t.labels.newTime}
            value={newDate}
            bold
            valueClassName="text-success"
          />
          <DetailRow label={t.labels.mode} value={sessionMode} />
        </Section>
      </Section>

      <Section className="mt-5">
        <Text className="text-fg-3 m-0 text-[13px] leading-relaxed">
          {t.booking.icsHintUpdate}
        </Text>
      </Section>
    </EmailLayout>
  )
}

BookingRescheduledEmail.PreviewProps = {
  patientName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  previousDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  newDate: "Quarta-feira, 18 de junho de 2026, 14:00",
  sessionMode: "online",
  locale: "pt",
} satisfies BookingRescheduledProps

export default BookingRescheduledEmail
