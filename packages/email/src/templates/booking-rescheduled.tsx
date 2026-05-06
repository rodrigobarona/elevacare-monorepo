import { Column, Row, Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export interface BookingRescheduledProps {
  patientName: string
  eventTypeName: string
  previousDate: string
  newDate: string
  sessionMode: string
  locale?: EmailLocale
  jsonLd?: string
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
          <Row className="mb-2">
            <Column className="w-[110px] align-top">
              <Text className="text-fg-3 m-0 text-[13px]">
                {t.labels.patient}
              </Text>
            </Column>
            <Column className="align-top">
              <Text className="text-fg m-0 text-[14px] font-medium">
                {patientName}
              </Text>
            </Column>
          </Row>
          <Row className="mb-2">
            <Column className="w-[110px] align-top">
              <Text className="text-fg-3 m-0 text-[13px]">
                {t.labels.service}
              </Text>
            </Column>
            <Column className="align-top">
              <Text className="text-fg m-0 text-[14px]">{eventTypeName}</Text>
            </Column>
          </Row>
          <Row className="mb-2">
            <Column className="w-[110px] align-top">
              <Text className="text-fg-3 m-0 text-[13px]">
                {t.labels.previous}
              </Text>
            </Column>
            <Column className="align-top">
              <Text className="text-danger m-0 text-[14px] line-through">
                {previousDate}
              </Text>
            </Column>
          </Row>
          <Row className="mb-2">
            <Column className="w-[110px] align-top">
              <Text className="text-fg-3 m-0 text-[13px]">
                {t.labels.newTime}
              </Text>
            </Column>
            <Column className="align-top">
              <Text className="text-success m-0 text-[14px] font-medium">
                {newDate}
              </Text>
            </Column>
          </Row>
          <Row className="mb-2">
            <Column className="w-[110px] align-top">
              <Text className="text-fg-3 m-0 text-[13px]">{t.labels.mode}</Text>
            </Column>
            <Column className="align-top">
              <Text className="text-fg m-0 text-[14px]">{sessionMode}</Text>
            </Column>
          </Row>
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
