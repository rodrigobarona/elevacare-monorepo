import { Section } from "react-email"
import { EmailButton } from "./email-button"
import { EmailBodyText } from "./email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"

export function JoinSessionCta({
  href,
  locale,
}: {
  href: string
  locale: EmailLocale
}) {
  const t = getEmailTranslations(locale)
  return (
    <>
      <EmailBodyText className="mt-[24px] mb-[16px] text-[13px] leading-[20px]">
        {t.booking.joinHint}
      </EmailBodyText>
      <Section className="mb-[8px]">
        <EmailButton href={href}>{t.booking.joinCta}</EmailButton>
      </Section>
    </>
  )
}
