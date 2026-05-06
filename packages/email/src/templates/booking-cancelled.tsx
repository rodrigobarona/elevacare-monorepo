import { Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import { DetailRow } from "./detail-row"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export interface BookingCancelledProps {
  patientName: string
  eventTypeName: string
  formattedDate: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
}

export function BookingCancelledEmail({
  patientName,
  eventTypeName,
  formattedDate,
  locale = "en",
  jsonLd,
}: BookingCancelledProps) {
  const t = getEmailTranslations(locale)

  return (
    <EmailLayout
      preview={t.subject.cancelled(patientName, formattedDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <Section className="border-stroke bg-bg rounded-xl border p-8">
        <Text className="text-fg m-0 mb-1 text-[22px] leading-tight font-semibold tracking-tight">
          {t.booking.cancelledTitle}
        </Text>
        <Text className="text-fg-3 m-0 mb-6 text-[14px] leading-relaxed">
          {t.booking.cancelledSubtitle}
        </Text>

        <Section className="bg-bg-2 rounded-lg p-5">
          <DetailRow label={t.labels.patient} value={patientName} bold />
          <DetailRow label={t.labels.service} value={eventTypeName} />
          <DetailRow
            label={t.labels.wasScheduled}
            value={formattedDate}
            valueClassName="text-danger"
          />
        </Section>
      </Section>

      <Section className="mt-5">
        <Text className="text-fg-3 m-0 text-[13px] leading-relaxed">
          {t.booking.icsHintRemove}
        </Text>
      </Section>
    </EmailLayout>
  )
}

BookingCancelledEmail.PreviewProps = {
  patientName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  formattedDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  locale: "pt",
} satisfies BookingCancelledProps

export default BookingCancelledEmail
