import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { JoinSessionCta } from "../components/join-session-cta"
import { SessionAccess, type SessionPlace } from "../components/session-access"
import {
  UrgentHelpNote,
  type UrgentHelpDetail,
} from "../components/urgent-help-note"
import { getEmailTranslations, type EmailLocale } from "../i18n"
import { formatSessionMode } from "../session-mode"

export interface BookingRescheduledProps {
  memberName: string
  eventTypeName: string
  previousDate: string
  newDate: string
  sessionMode: string
  locale?: EmailLocale
  jsonLd?: Record<string, unknown>
  /** Eleva join page. Never a raw Daily room URL. */
  joinHref?: string
  place?: SessionPlace
  /** Member copy only: the number the expert will call, masked. */
  maskedPhone?: string | null
  /** Who the email greets; defaults to memberName. */
  greetingName?: string
  /** The other person's row ("Member" for experts, "Expert" for members). */
  counterpartLabel?: string
  counterpartName?: string
  subheading?: string
  preview?: string
  /** Member copy only: where to turn when something cannot wait. */
  urgentHelp?: UrgentHelpDetail
}

export function BookingRescheduledEmail({
  memberName,
  eventTypeName,
  previousDate,
  newDate,
  sessionMode,
  locale = "en",
  jsonLd,
  joinHref,
  place,
  maskedPhone,
  greetingName,
  counterpartLabel,
  counterpartName,
  subheading,
  preview,
  urgentHelp,
}: BookingRescheduledProps) {
  const t = getEmailTranslations(locale)

  return (
    <EmailLayout
      preview={preview ?? t.subject.rescheduled(memberName, newDate)}
      locale={locale}
      jsonLd={jsonLd}
    >
      <EmailHeading>{t.booking.rescheduledTitle}</EmailHeading>
      <EmailBodyText className="mb-[8px]">
        {t.booking.greeting(greetingName ?? memberName)}
      </EmailBodyText>
      <EmailBodyText className="mb-[24px]">
        {subheading ?? t.booking.rescheduledSubtitle}
      </EmailBodyText>

      <EmailCard>
        <DetailRow
          label={counterpartLabel ?? t.labels.member}
          value={counterpartName ?? memberName}
          bold
        />
        <DetailRow label={t.labels.service} value={eventTypeName} />
        <DetailRow
          label={t.labels.previous}
          value={previousDate}
          valueClassName="text-danger"
        />
        <DetailRow
          label={t.labels.newTime}
          value={newDate}
          bold
          valueClassName="text-success"
        />
        <DetailRow
          label={t.labels.mode}
          value={formatSessionMode(sessionMode, locale)}
        />
      </EmailCard>

      {joinHref ? <JoinSessionCta href={joinHref} locale={locale} /> : null}
      <SessionAccess
        sessionMode={sessionMode}
        locale={locale}
        place={place}
        maskedPhone={maskedPhone}
      />

      <EmailBodyText className="mt-[24px] text-[13px] leading-[20px]">
        {t.booking.icsHintUpdate}
      </EmailBodyText>
      {urgentHelp ? (
        <UrgentHelpNote locale={locale} detail={urgentHelp} />
      ) : null}
    </EmailLayout>
  )
}

BookingRescheduledEmail.PreviewProps = {
  memberName: "Maria Silva",
  eventTypeName: "Primeira Consulta",
  previousDate: "Segunda-feira, 16 de junho de 2026, 10:00",
  newDate: "Quarta-feira, 18 de junho de 2026, 14:00",
  sessionMode: "phone",
  locale: "pt",
} satisfies BookingRescheduledProps

export default BookingRescheduledEmail
