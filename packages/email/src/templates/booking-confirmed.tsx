import { Section } from "react-email"
import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { EmailButton } from "../components/email-button"
import { JoinSessionCta } from "../components/join-session-cta"
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
  /** Eleva join page. Never a raw Daily room URL. */
  joinHref?: string
  audience?: "member" | "expert"
  greetingName?: string
  activateHref?: string
  calendarHref?: string
  memberEmail?: string
  memberPhone?: string
  duration?: string
  timezone?: string
  language?: string
  country?: string
  price?: string
  cancellationPolicyName?: string
}

export function BookingConfirmedEmail({
  memberName,
  eventTypeName,
  formattedDate,
  sessionMode,
  location,
  locale = "en",
  jsonLd,
  joinHref,
  audience = "member",
  greetingName,
  activateHref,
  calendarHref,
  memberEmail,
  memberPhone,
  duration,
  timezone,
  language,
  country,
  price,
  cancellationPolicyName,
}: BookingConfirmedProps) {
  const t = getEmailTranslations(locale)
  const isExpert = audience === "expert"
  const greet = greetingName ?? memberName
  const title = isExpert
    ? t.booking.expertConfirmedTitle
    : t.booking.confirmedTitle
  const subtitle = isExpert
    ? t.booking.expertConfirmedSubtitle
    : t.booking.confirmedSubtitle
  const preview = t.subject.newBooking(memberName, formattedDate)

  return (
    <EmailLayout preview={preview} locale={locale} jsonLd={jsonLd}>
      <EmailHeading>{title}</EmailHeading>
      <EmailBodyText className="mb-[8px]">
        {t.booking.greeting(greet)}
      </EmailBodyText>
      <EmailBodyText className="mb-[24px]">{subtitle}</EmailBodyText>

      <EmailCard>
        <DetailRow label={t.labels.member} value={memberName} bold />
        {isExpert && memberEmail ? (
          <DetailRow label={t.labels.email} value={memberEmail} />
        ) : null}
        {isExpert && memberPhone ? (
          <DetailRow label={t.labels.phone} value={memberPhone} />
        ) : null}
        <DetailRow label={t.labels.service} value={eventTypeName} />
        <DetailRow label={t.labels.dateTime} value={formattedDate} />
        {isExpert && timezone ? (
          <DetailRow label={t.labels.timezone} value={timezone} />
        ) : null}
        {isExpert && duration ? (
          <DetailRow label={t.labels.duration} value={duration} />
        ) : null}
        <DetailRow
          label={t.labels.mode}
          value={formatSessionMode(sessionMode, locale)}
        />
        {location ? (
          <DetailRow label={t.labels.location} value={location} />
        ) : null}
        {isExpert && language ? (
          <DetailRow label={t.labels.language} value={language} />
        ) : null}
        {isExpert && country ? (
          <DetailRow label={t.labels.country} value={country} />
        ) : null}
        {isExpert && price ? (
          <DetailRow label={t.labels.price} value={price} />
        ) : null}
        {isExpert && cancellationPolicyName ? (
          <DetailRow
            label={t.labels.cancellationPolicy}
            value={cancellationPolicyName}
          />
        ) : null}
      </EmailCard>

      {joinHref ? <JoinSessionCta href={joinHref} locale={locale} /> : null}

      {activateHref ? (
        <>
          <EmailBodyText className="mt-[24px] mb-[16px] text-[13px] leading-[20px]">
            {t.booking.activateHint}
          </EmailBodyText>
          <Section className="mb-[8px]">
            <EmailButton href={activateHref} variant="secondary">
              {t.booking.activateCta}
            </EmailButton>
          </Section>
        </>
      ) : null}

      {calendarHref ? (
        <Section className="mt-[16px] mb-[8px]">
          <EmailButton href={calendarHref} variant="secondary">
            {t.booking.calendarCta}
          </EmailButton>
        </Section>
      ) : null}

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
