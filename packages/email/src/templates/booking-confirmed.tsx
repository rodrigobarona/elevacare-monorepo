import { Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import { DetailRow } from "./detail-row"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export interface BookingConfirmedProps {
  patientName: string
  eventTypeName: string
  formattedDate: string
  sessionMode: string
  location?: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
}

export function BookingConfirmedEmail({
  patientName,
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
      preview={t.subject.newBooking(patientName, formattedDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <Section className="border-stroke bg-bg rounded-xl border p-8">
        <Text className="text-fg m-0 mb-1 text-[22px] leading-tight font-semibold tracking-tight">
          {t.booking.confirmedTitle}
        </Text>
        <Text className="text-fg-3 m-0 mb-6 text-[14px] leading-relaxed">
          {t.booking.confirmedSubtitle}
        </Text>

        <Section className="bg-bg-2 rounded-lg p-5">
          <DetailRow label={t.labels.patient} value={patientName} bold />
          <DetailRow label={t.labels.service} value={eventTypeName} />
          <DetailRow label={t.labels.dateTime} value={formattedDate} />
          <DetailRow label={t.labels.mode} value={sessionMode} />
          {location && <DetailRow label={t.labels.location} value={location} />}
        </Section>
      </Section>

      <Section className="mt-5">
        <Text className="text-fg-3 m-0 text-[13px] leading-relaxed">
          {t.booking.icsHintAdd}
        </Text>
      </Section>
    </EmailLayout>
  )
}

BookingConfirmedEmail.PreviewProps = {
  patientName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  formattedDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  sessionMode: "online",
  locale: "pt",
} satisfies BookingConfirmedProps

export default BookingConfirmedEmail
