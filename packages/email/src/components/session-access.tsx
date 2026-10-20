import { Section } from "react-email"
import { EmailButton } from "./email-button"
import { EmailBodyText } from "./email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export interface SessionPlace {
  name: string
  address: string
  mapsHref: string
  instructions?: string
}

/**
 * How the member reaches the session when it is not a video call. Online
 * sessions use `JoinSessionCta` instead.
 */
export function SessionAccess({
  sessionMode,
  locale,
  place,
  maskedPhone,
}: {
  sessionMode: string
  locale: EmailLocale
  place?: SessionPlace
  /** Member copy only: the number the expert will call, already masked. */
  maskedPhone?: string | null
}) {
  const t = getEmailTranslations(locale)
  if (sessionMode === "in_person" && place) {
    return (
      <>
        <EmailBodyText className="mt-[24px] mb-[4px] font-semibold">
          {place.name}
        </EmailBodyText>
        <EmailBodyText className="mb-[16px]">{place.address}</EmailBodyText>
        {place.instructions ? (
          <EmailBodyText className="mb-[16px] text-[13px] leading-[20px]">
            {place.instructions}
          </EmailBodyText>
        ) : null}
        <Section className="mb-[8px]">
          <EmailButton href={place.mapsHref} variant="secondary">
            {t.booking.openInMaps}
          </EmailButton>
        </Section>
      </>
    )
  }
  if (sessionMode === "phone" && maskedPhone !== undefined) {
    return (
      <EmailBodyText className="mt-[24px]">
        {maskedPhone
          ? t.booking.phoneCallNotice(maskedPhone)
          : t.booking.phoneCallNoticeNoNumber}
      </EmailBodyText>
    )
  }
  return null
}
